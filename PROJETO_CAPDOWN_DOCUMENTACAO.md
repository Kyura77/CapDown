# CapDown - Documentação Arquitetural e "Code-by-Code" (Deep Dive)

O **CapDown** é um ecossistema complexo para leitura e download de mangás que resolve o problema de armazenamento em nuvem através de uma arquitetura **"Telegram First"**. Em vez de pagar por buckets S3 ou lotar o disco rígido do usuário, a aplicação orquestra uploads invisíveis para a infraestrutura do Telegram e consome os arquivos gerando links efêmeros.

Abaixo, dissecamos o projeto arquivo por arquivo, focando nos trechos de código mais críticos do sistema.

---

## 1. Fastify & Server Configuration (`apps/api/src/server.ts`)

A API Core é construída em **Node.js** com **Fastify**. O arquivo de inicialização não apenas registra as rotas, mas impõe as barreiras de segurança e CORS.

```typescript
// apps/api/src/server.ts (Extrato)

export async function buildServer(config: ApiConfig) {
  const app = Fastify({ logger: true });
  
  // 1. Definição rígida de CORS baseada no Ambiente.
  // Permite localhost e IP local (para o app nativo via Capacitor rodando no celular na mesma rede).
  const corsOrigins = process.env.CAPDOWN_CORS_ORIGINS
    ? process.env.CAPDOWN_CORS_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'capacitor://localhost',
        /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/, // Regex crucial para LAN testing
      ];

  await app.register(cors, { origin: corsOrigins, methods: ['GET', 'PUT', 'POST', 'DELETE'] });

  // 2. Hook de Segurança Global (Middleware)
  // Intercepta TODAS as requisições antes de atingirem o Handler da rota.
  app.addHook('preHandler', async (request, reply) => {
    const url = request.routeOptions.url || request.url;
    
    // Rotas de leitura (GET de biblioteca, pesquisas) são públicas para o app.
    const isPublicGet = request.method === 'GET' && (
      url.startsWith('/api/library') || url.startsWith('/api/search')
    );

    // O acesso a dados sensíveis (como os tokens do telegram) requer a API Key.
    const isSettingsGet = request.method === 'GET' && url.startsWith('/api/settings');

    if (!isPublicGet || isSettingsGet) {
      const apiKey = process.env.CAPDOWN_API_KEY || 'dev-key-123';
      const providedKey = request.headers['x-api-key'] || request.headers['authorization'];
      
      // Valida o header 'x-api-key' ou o token 'Bearer' padrão.
      if (providedKey !== apiKey && providedKey !== `Bearer ${apiKey}`) {
        return reply.status(401).send({ code: 'unauthorized', message: 'Invalid API key.' });
      }
    }
  });
  
  // 3. Injeção de Dependências e Repositórios
  const prisma = new PrismaClient();
  const settingsRepo = new PrismaSettingsRepository(prisma);
  // ...
}
```
**Por que isso importa?** O uso do `preHandler` como interceptor global garante que nenhuma rota perigosa (ex: deletar mangá, baixar arquivo via worker) seja acessada sem a `CAPDOWN_API_KEY`, protegendo a instância se ela for exposta para a internet.

---

## 2. A Engine de Download (`apps/api/src/services/download-worker.ts`)

Este arquivo contém a lógica mais densa do projeto. Ele precisa iterar por centenas de imagens web, baixá-las sem ser bloqueado pelos provedores originais (Cloudflare/Rate Limits) e subir para o Telegram com segurança.

### 2.1 Semáforo e Concorrência

Para não tomar *Timeout* ou *Ban IP* dos provedores de mangá, o sistema nunca baixa 50 páginas de uma vez. Ele usa um Semáforo em memória:

```typescript
// Implementação clássica de Semáforo assíncrono para limitar concorrência
class Semaphore {
  private tasks: Array<() => void> = [];
  private active = 0;

  constructor(private maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return;
    }
    // Suspende a execução da Promise até que 'release()' seja chamado.
    return new Promise((resolve) => {
      this.tasks.push(resolve);
    });
  }

  release(): void {
    this.active--;
    const next = this.tasks.shift();
    if (next) {
      this.active++;
      next();
    }
  }
}
```

### 2.2 O Padrão de Retry e Spoofing

Ao iterar nas páginas, se uma imagem falhar (Erro 502/503 comum em servidores de scanlator), o backend não desiste do job. Ele tenta novamente usando **Backoff Exponencial**.

```typescript
async function fetchWithRetry(url: string, retries = 3): Promise<Buffer> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        timeoutMs: 20_000,
        headers: {
          // Spoofing completo de Headers para fingir ser um Firefox no Windows.
          // Sem isso, proteção anti-bot bloqueia downloads automáticos.
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0',
          'Accept': 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
          'Referer': 'https://verdinha.wtf/', 
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer()); // Converte a stream no Buffer cru
    } catch (error) {
      if (attempt === retries - 1) throw error; // Falhou de vez
      // Backoff Exponencial: Espera 1s, depois 2s, depois 4s...
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}
```

---

## 3. O "Telegram First" Storage (`apps/api/src/services/telegram-bot.ts`)

A infraestrutura inteira depende desta classe para salvar os arquivos. 

**O grande segredo:** Não se usa o método padrão `sendPhoto` da API do Telegram. O método `sendPhoto` impõe algoritmos de compressão (JPEG degradado) para economizar banda dos celulares. Para mangás (que possuem balões de texto pequenos), isso destrói a qualidade. A solução é enviar a imagem como um `Document` puro.

```typescript
// apps/api/src/services/telegram-bot.ts (Extrato)

async function sendDocument(buffer: Buffer, filename: string, chatId: string): Promise<string> {
    // 1. Converte o Buffer de memória do Node.js numa representação de arquivo que 
    // a API nativa do Fetch entenda (Blob/Uint8Array)
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([new Uint8Array(buffer)]), filename);

    // Endpoint sendDocument força o Telegram a armazenar o arquivo em disco bit a bit
    const url = `https://api.telegram.org/bot${this.botToken}/sendDocument`;

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      body: formData as any,
      timeoutMs: 60000, // Permite até 60s para páginas extremamente pesadas (HD)
    });

    const data = await response.json();
    
    // 2. Retorna a verdadeira "Chave Primária" da nossa arquitetura:
    // O file_id atua como o URL permanente em nosso banco de dados.
    return data.result.document.file_id;
}
```

---

## 4. O Microserviço Scraper (`apps/scraper/providers/verdinha.py`)

Construído em Python (FastAPI), este serviço isola lógicas propensas a quebra. A abstração de busca da *Verdinha* revela o quão cru e pragmático é o parsing.

```python
# apps/scraper/providers/verdinha.py (Extrato da função Search)

async def search(req: SearchRequest) -> List[UnifiedSearchResult]:
    # ... faz o GET na API subjacente do site original
    results = []
    for index, obra in enumerate(data.get("obras", [])):
        # Sanitização bruta: Garantir que tudo é String pura, sem tipagem solta.
        source_id = str(obra.get("obr_id"))
        title = str(obra.get("obr_nome")).strip()
        
        # Limite de Banco de Dados: Corta a sinopse em 200 caracteres para 
        # evitar travamento em views da UI Mobile.
        description = truncate_text(obra.get("obr_descricao"), 200)
        
        # Geraçao de Score para Ranking interno da nossa UI 
        # (Preserva a relevância ditada pelo provedor original diminuindo 0.01 por posição)
        score = max(0.0, 1.0 - index * 0.01)
        
        # Popula nosso modelo rígido (Pydantic / UnifiedSearchResult)
        result = UnifiedSearchResult(
            title=title,
            cover_url=build_cover_url(source_id, obra.get("scan_id"), obra.get("obr_imagem")),
            description=description,
            score=score,
            sources=[...]
        )
        results.append(result)
        
    return results
```

---

## 5. Type Safety com Zod (`packages/contracts/src/library.ts`)

Para evitar que o backend Python envie algo que quebre a interface em React, o sistema repousa sobre uma camada de Contratos `@capdown/contracts`. Estes contratos Zod são importados tanto no Backend (para enviar resposta) quanto no Frontend (para renderizar).

```typescript
// packages/contracts/src/library.ts

export const libraryPageSchema = z.object({
  index: z.number().int().positive(),
  // Força que a resposta NUNCA deixe de ter o file_id. 
  // Sem isso a UI de leitura quebraria silenciosamente.
  telegram_file_id: z.string().min(1), 
  telegram_message_id: z.number().int().nullable(),
});

// Payload completo e rico injetado na view do Reader do Usuário
export const readerChapterPayloadSchema = z.object({
  manga_id: z.string().min(1),
  manga_title: z.string().min(1),
  chapter: libraryChapterSchema,
  pages: z.array(libraryPageSchema), // Array garantidamente estruturada de páginas
  
  // Propriedades de navegação pré-calculadas pela API
  // Evitam que o Frontend precise iterar na listagem global só para achar 
  // qual é o "próximo capítulo" ou "capítulo anterior" para os botões do rodapé.
  prev_chapter: readerChapterNavSchema.nullable(),
  next_chapter: readerChapterNavSchema.nullable(),
});
```

---

## 6. O Cliente e o Estado Global (`apps/client/src/stores/useReaderStore.js`)

A UI do leitor lida com cenários sensíveis: o usuário pode fechar a aba no meio da leitura. A aplicação soluciona isso nativamente combinando **Zustand** com o middleware **Persist** do LocalStorage do navegador.

```javascript
// apps/client/src/stores/useReaderStore.js

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Zustand simplifica infinitamente a criação de Stores em relação ao Redux
export const useReaderStore = create(
  // Middleware persist empacota todo o objeto e serializa no storage local 
  // com a chave "capdown-reader-storage" automaticamente a cada alteração.
  persist(
    (set) => ({
      // Preferências globais do Reader persistidas
      readingMode: 'webtoon', // Modos: webtoon (scroll) ou manga (paginado horizontal)
      zoomLevel: 100,
      brightness: 100,
      
      // O Progress tracking aninha os IDs para O(1) time complexity no acesso:
      // Estrutura: { "manga_123": { chapterId: "cap_456", pageIndex: 5 } }
      progress: {}, 
      
      // Action: Salva silenciosamente de acordo com a interceptação do Observer
      // de interseção (IntersectionObserver) na tela de scroll da leitura.
      saveProgress: (mangaId, chapterId, pageIndex) => 
        set((state) => ({
          progress: {
            ...state.progress,
            [mangaId]: { chapterId, pageIndex } // Sobrescreve o progresso antigo deste mangá
          }
        })),
        
      // Action: Consumida ao abrir o mangá para restaurar a leitura exata
      getProgress: (mangaId) => (state) => state.progress[mangaId] || null,
    }),
    { name: 'capdown-reader-storage' }
  )
);
```

Este controle de estado permite que a UI do Leitor saiba exatamente onde renderizar e para onde dar scroll automático ao acessar um mangá existente na biblioteca do usuário, criando a sensação de um aplicativo mobile nativo real.