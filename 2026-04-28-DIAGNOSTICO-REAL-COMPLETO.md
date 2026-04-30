# DIAGNÓSTICO REAL — CapDown vs Planos Propostos

> Gerado: 2026-04-28
> Arquitetura atual vs planos: `scraper-explorer-agent` e `telegram-granular`
> Estado: ANÁLISE PROFUNDA PÓS-LEITURA DO PROJETO INTEIRO

---

## 📊 Estado Atual do Projeto (O que EXISTE)

### Arquitetura

**Stack:**
- ✅ API: Fastify (TypeScript) — `apps/api`
- ✅ Scraper: Python (módulo puro, NÃO FastAPI server) — `apps/scraper`
- ✅ Client: React + Vite + Capacitor (mobile) — `apps/client`
- ✅ DB: SQLite via Prisma
- ✅ Queue: BullMQ com Redis (fallback in-process se Redis indisponível)
- ✅ Storage: **TELEGRAM FIRST** — páginas armazenadas como `telegram_file_id`, não em disco local

**Banco de Dados Atual:**

```prisma
// Schema REAL (apps/api/prisma/schema.prisma)

model Settings {
  telegram_token: String?          // UM token apenas
  telegram_chat_id: String?
  enabled_providers_json: String?  // JSON serializado
}

model DownloadJob {
  // JOB MONOLÍTICO — baixa manga INTEIRO
  id: String
  url: String
  status: String  // queued, downloading, completed, failed
  manga_title: String?
  current_chapter: String?
  downloaded_pages: Int
  total_pages: Int
  downloaded_chapters: Int
  total_chapters: Int
  error: String?
  
  // Tudo serializado como JSON (anti-pattern)
  chapters_json: String?           // JSON array
  source_chapters_json: String?    // JSON array
  concurrency: Int
  source_manga_id: String?
  source_provider_id: String?
  terminal_reason: String?
}

model LibraryManga {
  id: String
  provider_id: String
  media_type: String @default("manga")
  source_id: String
  source_url: String
  title: String
  cover_url: String?
  chapters: LibraryChapter[]
  
  // ❌ SEM: telegram_topic_id, last_read_at, is_nsfw, is_pinned
}

model LibraryChapter {
  id: String
  source_id: String
  title: String
  number: String?
  source_url: String
  page_count: Int
  downloaded_at: DateTime
  manga_id: String
  pages: LibraryPage[]
}

model LibraryPage {
  id: String
  index: Int
  telegram_file_id: String        // ✅ TELEGRAM FIRST confirmado
  telegram_message_id: Int?
  chapter_id: String
  
  @@unique([chapter_id, index])
}
```

**Worker Atual (download-worker.ts):**

```typescript
// Fluxo REAL de download

export interface DownloadPlan {
  jobId: string;
  mangaId: string;
  chapters: DownloadPlanChapter[];  // TODOS os capítulos juntos
  totalPages: number;
  totalChapters: number;
}

class DownloadWorker {
  async processJob(jobId, plan) {
    for (const chapter of plan.chapters) {  // ❌ Loop sequencial
      const pages = await adapter.getChapterPages(chapter.id);
      
      for (const page of pages) {  // Download paralelo (concurrency: 3)
        const buffer = await fetch(page.url);
        const telegramFileId = await telegramBot.sendDocument(buffer);
        await library.upsertLibraryPage(chapter.id, page.index, telegramFileId);
      }
      
      totalChaptersDownloaded++;
      // ❌ Se falha um capítulo: apenas continua (sem retry granular)
    }
  }
}
```

**BullMQ Atual (download-queue.ts):**

```typescript
// UM job = UM manga completo
class DownloadQueue {
  async enqueue(plan: DownloadPlan) {
    // ❌ Enfileira manga inteiro (não por capítulo)
    await this.queue.add(plan.jobId, plan, {
      jobId: plan.jobId,
      attempts: 2,  // Retry do job inteiro se falhar
      concurrency: 2,  // 2 mangas simultâneos (não capítulos)
    });
  }
}
```

**Telegram Bot Atual (telegram-bot.ts):**

```typescript
// SUPER BÁSICO — apenas upload/download
class TelegramBotService {
  async sendDocument(buffer, filename, chatId): Promise<string> {
    // ✅ Upload via API do Telegram
    // ✅ Retorna file_id
    // ❌ SEM: fóruns, mensagens, botões, polling, edição
  }
  
  async getFileUrl(fileId): Promise<string> {
    // ✅ Retorna URL temporária (1h válida)
  }
  
  // ❌ SEM: createForumTopic, sendMessage, editMessage, onCallback, startPolling
}
```

**Scraper Python Atual (verdinha.py exemplo):**

```python
# Interface simples via httpx async

async def search(req: SearchRequest) -> List[UnifiedSearchResult]:
    # Busca obras na API do provider
    pass

async def preview(url: str) -> PreviewResponse:
    # Lista capítulos disponíveis
    pass

async def get_chapter_pages(source_id: str) -> List[PageResult]:
    # Retorna URLs das páginas
    pass

# ❌ SEM: text_content (novels), network capture, desofuscação JS
```

---

## 🔥 Problemas Reais vs Planos Propostos

### PLANO: Telegram Granular

**Problemas identificados:**

| # | Problema no Plano | Realidade do Código | Impacto |
|---|-------------------|---------------------|---------|
| 1 | **Schema novo ignora migration** | Schema propõe deletar `DownloadJob` e criar `ChapterDownloadJob` SEM script de migração | Deploy quebra banco |
| 2 | **Tokens no banco é antipadrão** | Plano original: array JSON no DB. Correção: env vars | Original = falha de segurança grave |
| 3 | **CBZ export via JSZip em memória** | Manga com 300 páginas = OOM | Crash do Node.js |
| 4 | **SSE sem autenticação** | Qualquer pessoa com URL vê os logs | Vazamento de info |
| 5 | **Task 16 é outro projeto** | TomatoDown (vídeos) disfarçado de task | Scope creep absurdo |
| 6 | **Worker atual já existe** | Plano quer criar `download-worker.ts` do zero, mas JÁ EXISTE | Código duplicado |
| 7 | **ProductStateService já coordena tudo** | Plano ignora que `product-state-service.ts` já é o Ralph Loop | Arquitetura quebrada |
| 8 | **TelegramBotService precisa TOTAL rewrite** | Código atual: 74 linhas, 2 métodos. Plano: 300+ linhas, 10+ métodos | Underestimou complexidade |
| 9 | **Sem deduplicação de capítulos** | Radar pode enfileirar o mesmo capítulo 2x | Jobs duplicados |
| 10 | **Backup SQL pode ser > 50MB** | Limite Telegram: 50MB. SQLite binário cresce rápido | Upload falha |
| 11 | **Pre-load do Reader tem memory leak** | `URL.createObjectURL` sem `revokeObjectURL` | Browser trava com tempo |
| 12 | **Anilist OAuth sem detalhes** | Plano: "integrar Anilist". Sem flow, sem endpoints | Implementação ambígua |

---

### PLANO: Scraper Explorer Agent

**Problemas identificados:**

| # | Problema no Plano | Realidade do Código | Impacto |
|---|-------------------|---------------------|---------|
| 1 | **Nenhuma integração com scraper atual** | Plano cria ferramenta standalone. Não substitui `apps/scraper/providers/*.py` | Duplicação total |
| 2 | **API atual não chama scraper via HTTP** | Scraper é módulo Python importado. Plano assume FastAPI server | Arquitetura incompatível |
| 3 | **`esprima-python` morto desde 2018** | Task 7 usa lib abandonada | Não funciona |
| 4 | **Playwright sem stealth = ban imediato** | Cloudflare/DataDome detecta sem config anti-bot | Ferramenta inútil |
| 5 | **Prompt LLM sem template explícito** | LLM gera código inconsistente toda vez | Output não confiável |
| 6 | **Auto-repair sem trigger definido** | Task 6: "repair automático" mas não diz QUANDO rodar | Lógica incompleta |
| 7 | **Logs não salvos em disco** | Impossível debug ou replay | UX péssima |
| 8 | **Auto-clicker usa Langchain sem detalhes** | Task 8: "Langchain + Computer Use" sem nenhum código | Overhead enorme |
| 9 | **Nenhum modo `--replay`** | Testar LLM requer abrir browser toda vez | Lentidão absurda |
| 10 | **Tokens API hardcoded** | Prompt sugere `os.environ.get()` mas sem Pydantic Settings | Antipadrão |

---

## 🎯 O que os Planos ACERTARAM

### Telegram Granular ✅

1. **Conceito de granularidade** — separar job por capítulo faz sentido total
2. **Fóruns do Telegram** — excelente UX, um tópico por manga
3. **Inline buttons** — retry/delete interativos via callback
4. **Rotação de tokens** — evita rate limit, mas deve ser env var (não DB)
5. **Backup automático** — dump SQL comprimido resolve limite de 50MB
6. **Radar com deduplicação** — checagem de `manga_id + chapter_id` único

### Scraper Explorer ✅

1. **Network logger com Playwright** — capturar XHR/Fetch é correto
2. **Filtro de analytics** — remover ruído é essencial
3. **LLM para geração de código** — aceleraria criar providers novos
4. **HAR export** — padrão da indústria, abre no Chrome DevTools
5. **Auto-clicker com vision** — Claude Vision é superior a Langchain pra isso
6. **Modo replay** — essencial pra iterar no prompt LLM sem abrir browser

---

## ⚙️ Mudanças OBRIGATÓRIAS nos Planos

### Telegram Granular — Correções Críticas

#### 1. Schema Migration Real

**ERRADO (plano original):**
```prisma
// Deletar DownloadJob, criar ChapterDownloadJob
// SEM script de migração
```

**CORRETO:**
```typescript
// Script: apps/api/src/migrations/migrate-download-jobs.ts

async function migrate() {
  // 1. Verifica se DownloadJob existe
  const old = await prisma.$queryRaw`SELECT * FROM DownloadJob`;
  
  // 2. Para cada DownloadJob antigo:
  for (const job of old) {
    const chapterIds = JSON.parse(job.source_chapters_json || '[]');
    
    // 3. Cria ChapterDownloadJob por capítulo
    for (const chapterId of chapterIds) {
      await prisma.chapterDownloadJob.create({
        manga_id: job.source_manga_id,
        chapter_id: chapterId,
        status: job.status === 'completed' ? 'completed' : 'failed',
        // ... resto dos campos
      });
    }
  }
  
  // 4. Só DEPOIS deleta tabela antiga
  // await prisma.$executeRaw`DROP TABLE DownloadJob`;
}
```

#### 2. Worker Refatorado (Não do Zero)

**ERRADO (plano):**
Criar `download-worker.ts` novo

**CORRETO:**
Modificar `apps/api/src/services/download-worker.ts` atual

```typescript
// ANTES (atual): processa manga inteiro
export interface DownloadPlan {
  chapters: DownloadPlanChapter[];  // array
}

// DEPOIS (granular): processa UM capítulo
export interface ChapterJobPayload {
  jobId: string;        // ChapterDownloadJob.id
  chapterId: string;
  mangaId: string;
  sourceUrl: string;
}

export class DownloadWorker {
  // Muda assinatura
  async processJob(payload: ChapterJobPayload) {
    // Baixa UM capítulo apenas
    const pages = await adapter.getChapterPages(payload.chapterId);
    
    for (const page of pages) {
      // ... mesmo fluxo de upload Telegram
    }
    
    // Atualiza ChapterDownloadJob específico
    await prisma.chapterDownloadJob.update({
      where: { id: payload.jobId },
      data: { status: 'completed', downloaded_pages: pages.length }
    });
  }
}
```

#### 3. ProductStateService — Adaptar, Não Reescrever

**PROBLEMA:**
Plano ignora que `ProductStateService` já existe e já coordena tudo.

**SOLUÇÃO:**
```typescript
// apps/api/src/store/product-state-service.ts

class ProductStateService {
  // MUDA createDownload para criar múltiplos ChapterDownloadJob
  async createDownload(input: DownloadRequest) {
    const manga = await this.findManga(input.url);
    
    // ✅ GRANULAR: um job por capítulo
    const chapterIds = input.chapters ?? manga.chapters.map(c => c.id);
    
    for (const chapterId of chapterIds) {
      // Deduplicação
      const existing = await prisma.chapterDownloadJob.findUnique({
        where: { manga_id_chapter_id: { manga_id: manga.id, chapter_id: chapterId } }
      });
      
      if (existing) continue;  // Pula duplicado
      
      // Cria job granular
      const job = await prisma.chapterDownloadJob.create({
        data: {
          manga_id: manga.id,
          chapter_id: chapterId,
          status: 'queued',
          // ...
        }
      });
      
      // Enfileira no BullMQ
      await this.downloadQueue.enqueue({
        jobId: job.id,
        chapterId,
        mangaId: manga.id,
        sourceUrl: chapter.source_url,
      });
    }
  }
}
```

#### 4. TelegramBotService — Rewrite Total

**CÓDIGO ATUAL:** 74 linhas, 2 métodos
**NECESSÁRIO:** 300+ linhas, 10+ métodos

```typescript
// apps/api/src/services/telegram-bot.ts

import { Telegraf } from 'telegraf';  // ✅ Usar Telegraf, não fetch puro

// Tokens via env (NUNCA no banco)
const TOKENS = (process.env.TELEGRAM_TOKENS ?? '').split(',').filter(Boolean);

export class TelegramBotService {
  private bots: Telegraf[];
  private currentTokenIndex = 0;
  
  constructor() {
    this.bots = TOKENS.map(token => new Telegraf(token));
  }
  
  // Round-robin para uploads (evita rate limit)
  private nextBot(): Telegraf {
    const bot = this.bots[this.currentTokenIndex];
    this.currentTokenIndex = (this.currentTokenIndex + 1) % this.bots.length;
    return bot;
  }
  
  // ✅ NOVO: Criar fórum
  async createForumTopic(name: string): Promise<number> {
    const chatId = process.env.TELEGRAM_CHAT_ID!;
    const result = await this.bots[0].telegram.createForumTopic(chatId, name);
    return result.message_thread_id;
  }
  
  // ✅ NOVO: Enviar mensagem com botões
  async sendMessage(text: string, options?: {
    threadId?: number;
    buttons?: { text: string; callbackData: string }[][];
  }): Promise<number> {
    const chatId = process.env.TELEGRAM_CHAT_ID!;
    const msg = await this.bots[0].telegram.sendMessage(chatId, text, {
      message_thread_id: options?.threadId,
      parse_mode: 'HTML',
      reply_markup: options?.buttons ? {
        inline_keyboard: options.buttons.map(row =>
          row.map(btn => ({ text: btn.text, callback_data: btn.callbackData }))
        )
      } : undefined,
    });
    return msg.message_id;
  }
  
  // ✅ NOVO: Editar mensagem existente
  async editMessage(messageId: number, text: string) {
    const chatId = process.env.TELEGRAM_CHAT_ID!;
    await this.bots[0].telegram.editMessageText(chatId, messageId, undefined, text, {
      parse_mode: 'HTML',
    });
  }
  
  // ✅ NOVO: Polling de callbacks
  onCallback(prefix: string, handler: (jobId: string) => Promise<void>) {
    for (const bot of this.bots) {
      bot.on('callback_query', async (ctx) => {
        const data = (ctx.callbackQuery as any).data as string;
        if (data.startsWith(prefix)) {
          const jobId = data.substring(prefix.length + 1);  // "RETRY_jobid"
          await handler(jobId);
          await ctx.answerCbQuery('✓');
        }
      });
    }
  }
  
  startPolling() {
    for (const bot of this.bots) {
      bot.launch({ dropPendingUpdates: true });
    }
  }
  
  // ... resto dos métodos (pin, upload com round-robin)
}
```

#### 5. Backup SQL Corrigido

**PROBLEMA:** SQLite binário pode ter 200MB

**SOLUÇÃO:**
```typescript
// apps/api/src/jobs/backup-cron.ts
import { execSync } from 'child_process';
import { createGzip } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

async function runBackup() {
  const dumpPath = `/tmp/backup-${Date.now()}.sql`;
  const gzPath = `${dumpPath}.gz`;
  
  // SQL dump como texto (não binário)
  execSync(`sqlite3 "${DB_PATH}" .dump > "${dumpPath}"`);
  
  // Comprimir com gzip level 9
  await pipeline(
    createReadStream(dumpPath),
    createGzip({ level: 9 }),
    createWriteStream(gzPath)
  );
  
  const sizeMB = statSync(gzPath).size / 1_048_576;
  
  if (sizeMB > 50) {
    console.error('Backup muito grande mesmo comprimido');
    return;
  }
  
  await telegramBot.sendDocument(gzPath, `Backup ${new Date().toISOString()}`);
}
```

---

### Scraper Explorer — Correções Críticas

#### 1. Integração Real com Scraper Atual

**PROBLEMA:** Plano cria ferramenta isolada que não ajuda o projeto

**SOLUÇÃO:**
```bash
# Estrutura CORRETA
apps/
  scraper/
    providers/
      verdinha.py       # Código gerado MANUALMENTE
      egotoons.py
    
tools/
  scraper-explorer/     # FERRAMENTA para GERAR providers novos
    src/
      network_logger.py
      llm_agent.py
    output/
      adapter_draft.py  # → copiado pra apps/scraper/providers/ após review
```

**Workflow:**
1. Dev roda: `uv run scraper-explorer record https://site-novo.com --target "imagens de manga"`
2. Ferramenta gera: `tools/scraper-explorer/output/adapter_draft.py`
3. Dev revisa, ajusta, copia pra `apps/scraper/providers/site_novo.py`
4. Dev testa com API: `POST /api/scrape { provider: "site_novo" }`

#### 2. Tree-Sitter em Vez de Esprima

**ERRADO:**
```python
import esprima  # MORTO desde 2018
```

**CORRETO:**
```python
import tree_sitter_javascript as tsjs
from tree_sitter import Language, Parser

JS_LANGUAGE = Language(tsjs.language())

def extract_api_calls(js_code: str):
    parser = Parser(JS_LANGUAGE)
    tree = parser.parse(js_code.encode())
    
    # Query para fetch/axios
    query = JS_LANGUAGE.query("""
      (call_expression
        function: [(identifier) (member_expression)] @fn
        arguments: (arguments (string) @url))
    """)
    
    for node, _ in query.matches(tree.root_node):
        url = js_code[node.start_byte:node.end_byte]
        yield url.strip("\"'`")
```

#### 3. Stealth Config Obrigatório

**PROBLEMA:** Playwright sem stealth = Cloudflare bloqueia

**SOLUÇÃO:**
```python
def start_recording(url: str):
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
            ]
        )
        
        context = browser.new_context(
            user_agent='Mozilla/5.0 ...',  # Real user agent
            locale='pt-BR',
            timezone_id='America/Sao_Paulo',
        )
        
        # Remove propriedades de webdriver
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        """)
        
        page = context.new_page()
        # ... resto
```

#### 4. Modo Replay Obrigatório

**NECESSÁRIO:**
```python
# main.py (CLI Typer)

@app.command()
def replay(
    logs_file: str,
    target: str,
    output: str = "adapter_draft.py"
):
    """Analisa logs existentes SEM abrir browser. Testa prompts rápido."""
    logs = json.loads(Path(logs_file).read_text())
    cleaned = clean_logs(logs)
    code = generate_adapter(cleaned, target)
    save_adapter(code, output)
```

**Uso:**
```bash
# Grava uma vez
uv run scraper-explorer record https://site.com --target "manga chapters"

# Testa variações de prompt SEM abrir browser (segundos vs minutos)
uv run scraper-explorer replay logs/logs_20260428.json --target "busca de obras"
uv run scraper-explorer replay logs/logs_20260428.json --target "URLs de imagens"
```

---

## 📋 Checklist de Implementação CORRIGIDA

### Telegram Granular (Ordem de Execução)

```
PREPARAÇÃO (não quebre o que funciona)
[ ] 1. Adicionar Telegraf dependency: npm install telegraf
[ ] 2. Adicionar archiver: npm install archiver @types/archiver
[ ] 3. Criar .env com TELEGRAM_TOKENS (não no DB)

FASE 1 — Schema (estimativa: 2h)
[ ] 4. Schema: adicionar ChapterDownloadJob, telegram_topic_id, is_nsfw, last_read_at
[ ] 5. Rodar: npx prisma db push
[ ] 6. Script de migração: migrate-download-jobs.ts
[ ] 7. Rodar migração em ambiente de dev
[ ] 8. Verificar no Prisma Studio

FASE 2 — Telegram Bot Service (estimativa: 3h)
[ ] 9. Reescrever telegram-bot.ts usando Telegraf
[ ] 10. Adicionar: createForumTopic, sendMessage, editMessage
[ ] 11. Adicionar: onCallback, startPolling
[ ] 12. Round-robin de tokens (env vars, não DB)
[ ] 13. Testar polling manualmente

FASE 3 — Worker Granular (estimativa: 2h)
[ ] 14. Modificar download-worker.ts: DownloadPlan → ChapterJobPayload
[ ] 15. Modificar download-queue.ts: concurrency config
[ ] 16. Modificar product-state-service.ts: createDownload → loop de capítulos
[ ] 17. Adicionar deduplicação (findUnique manga_id+chapter_id)

FASE 4 — Features (estimativa: 1 dia)
[ ] 18. Backup cron: dump SQL + gzip
[ ] 19. Radar cron: com deduplicação
[ ] 20. CBZ export: archiver stream (NÃO JSZip)
[ ] 21. Pre-load Reader: com URL.revokeObjectURL
[ ] 22. SSE logs: com autenticação

FASE 5 — Premium (estimativa: 2 dias)
[ ] 23. Anilist OAuth completo
[ ] 24. Modo Família (is_nsfw filter)
[ ] 25. Pins no Telegram
```

### Scraper Explorer (Ordem de Execução)

```
SETUP (estimativa: 1h)
[ ] 1. Criar tools/scraper-explorer/ com pyproject.toml
[ ] 2. Dependencies: playwright, tree-sitter-javascript, typer, litellm
[ ] 3. Config: Pydantic Settings + .env
[ ] 4. uv sync + playwright install chromium

CORE (estimativa: 3h)
[ ] 5. network_logger.py: com stealth config
[ ] 6. filter.py: deduplicação + analytics
[ ] 7. llm_agent.py: prompt com template Provider
[ ] 8. main.py: CLI Typer com record + replay

ADVANCED (estimativa: 1 dia)
[ ] 9. ast_analyzer.py: tree-sitter (NÃO esprima)
[ ] 10. auto_clicker.py: Claude Vision (NÃO Langchain)
[ ] 11. auto_repair.py: com trigger HTTP check
[ ] 12. har_export.py: padrão da indústria

INTEGRAÇÃO (estimativa: 2h)
[ ] 13. README.md: workflow de uso
[ ] 14. Testar geração de provider
[ ] 15. Copiar output pra apps/scraper/providers/
[ ] 16. Testar provider novo na API
```

---

## 🚨 Avisos Finais

### O que NÃO fazer

1. ❌ **NÃO deletar** `DownloadJob` antes de migrar dados
2. ❌ **NÃO guardar** tokens Telegram no banco (env vars SEMPRE)
3. ❌ **NÃO criar** TomatoDown junto (é projeto separado)
4. ❌ **NÃO usar** JSZip em memória (archiver stream)
5. ❌ **NÃO usar** esprima-python (morto)
6. ❌ **NÃO usar** Langchain (overhead absurdo pra auto-clicker)
7. ❌ **NÃO implementar** SSE sem autenticação
8. ❌ **NÃO esquecer** cleanup de objectURL no Reader

### O que SEMPRE fazer

1. ✅ **Migração de dados** antes de schema change
2. ✅ **Deduplicação** em TODOS os pontos de criação de job
3. ✅ **Stealth config** em QUALQUER uso de Playwright
4. ✅ **Modo replay** em ferramentas com LLM
5. ✅ **Logs salvos** em disco SEMPRE
6. ✅ **Autenticação** em endpoints SSE
7. ✅ **Backup testado** antes de prod
8. ✅ **Env vars** para secrets (NUNCA DB)

---

## 📈 Estimativa Real

| Fase | Horas | Complexidade |
|------|-------|--------------|
| Telegram Granular Core | 7h | Média |
| Telegram Features | 24h | Alta |
| Scraper Explorer Core | 4h | Baixa |
| Scraper Explorer Advanced | 8h | Alta |
| **TOTAL** | **43h** | **~1 semana** |

**Fatores de risco:**
- Migração de dados pode ter edge cases não previstos
- Telegram polling pode ter bugs de concorrência
- LLM pode gerar código ruim nas primeiras tentativas

**Recomendação:**
Implementar **Telegram Granular Core** primeiro (Tasks 1-17), testar em produção, DEPOIS adicionar features premium. Scraper Explorer pode ser paralelo (não afeta produção).
