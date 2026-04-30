# Brainstorming: CapDown Telegram Architecture (Granularidade por Capítulo)

## 1. Contexto do Problema
O CapDown atualmente usa um modelo baseado em um `DownloadJob` monolítico. Quando um usuário pede para baixar "Solo Leveling" (com 100 capítulos), o sistema cria um único Job e processa os capítulos sequencialmente dentro do mesmo `processJob`. Se o capítulo 99 falhar de forma catastrófica (ou demorar muito), o capítulo 100 pode ficar travado. Além disso, o envio para o Telegram joga os arquivos em um único chat, dificultando a organização.

O objetivo desta refatoração é:
1. **Organizar o Telegram via Fóruns (Tópicos)**: Cada mangá terá um tópico próprio. Haverá um tópico global para logs/avisos.
2. **Isolamento de Capítulos**: Migrar a lógica para que cada Capítulo seja um Job independente na fila do BullMQ, e não um job monolítico para o mangá inteiro.
3. **Gerenciamento Híbrido**: O Telegram deve permitir controle com botões inline, e o App/Web também terá controle refinado por capítulo.
4. **Independência Real**: O erro num capítulo não afeta o download dos próximos.

## 2. Arquitetura de Tópicos no Telegram
Grupos do Telegram com a opção "Topics (Forums)" habilitada funcionam como pastas.

### Estrutura Proposta
- **Topic ID 1 (Geral / Logs)**: O bot notifica sobre sucessos/falhas e tarefas globais.
- **Topic ID X (Dinâmico)**: Criado via API (método `createForumTopic`) quando um mangá é baixado pela primeira vez. Cada mangá tem seu ID de tópico atrelado no banco de dados.

### Mudanças no Banco de Dados (`schema.prisma`)
Para suportar isso, o banco de dados precisará armazenar onde cada mangá está no Telegram.

```prisma
model LibraryManga {
  id                   String           @id @default(cuid())
  // ... (outros campos)
  telegram_topic_id    Int?             // O ID da thread (fórum) onde esse mangá mora
}

// O DownloadJob também mudará para ser por CAPÍTULO, não por Mangá.
model ChapterDownloadJob {
  id                  String   @id @default(cuid())
  manga_id            String
  chapter_source_id   String
  status              String   // queued, downloading, completed, failed
  error               String?
  // ... tracking de páginas
}
```

## 3. O Fluxo Híbrido (Banco de Dados + BullMQ)
1. **O Gatilho**: O usuário pede para baixar 10 capítulos (Web/Telegram).
2. **O Despachante (Database)**: A API cria 10 registros na tabela `ChapterDownloadJob` no banco de dados. (Para manter histórico).
3. **O BullMQ**: A API joga 10 mini-tarefas na fila `capdown:downloads`. Cada tarefa é simples: "Baixe o capítulo X do mangá Y".
4. **O Worker (Paralelo)**: O BullMQ pode pegar 2 ou 3 capítulos ao mesmo tempo (configurado por `concurrency`). Se o capítulo 99 der erro, ele vai pra fila de `failed` e entra na rotina de *retry* isolado. O capítulo 100 já estaria baixando ao mesmo tempo ou logo depois.

## 4. O Sistema de Avisos e Interatividade do Telegram
### Sucesso
Quando o capítulo termina, o bot faz três coisas:
1. Envia um log no **Tópico de Logs**: `"✅ Solo Leveling - Capítulo 10 baixado com sucesso."`
2. Na própria mensagem de log, ele anexa um teclado inline: `[ 🗑️ Apagar Capítulo ]`

### Falha
Quando o BullMQ esgota todas as tentativas de baixar um capítulo:
1. Envia um log no **Tópico de Logs**: `"❌ Erro: Não foi possível baixar Solo Leveling - Cap 11."`
2. Anexa um teclado inline: `[ 🔄 Tentar Novamente ]` `[ 🗑️ Cancelar ]`

## 5. Novas Features Premium (Aprovadas)

### 5.1. Backup Automático do DB
- Cron Job a cada 24h.
- Faz dump de `dev.db`.
- Bot envia `.db` para o Tópico de Logs no Telegram.
- Protege biblioteca e configurações.

### 5.2. Auto-Update (Radar)
- Fila `capdown:radar` (Repeatable Job no BullMQ).
- Checa novidades em obras da biblioteca (hora em hora).
- Se achar, enfileira download e avisa Telegram: *"🎉 Novo cap X lançado e baixado!"*.

### 5.3. Exportação Local (App/Web)
- Usuário clica "Download Local" na UI web.
- API puxa imagens do Telegram, compacta em `.cbz` (Comic Book Zip).
- Envia pro navegador. Sem salvar no disco do server.

### 5.4. Estatísticas de Leitura
- API de marcação de progresso registra tempo e data (`last_read_at`, `pages_read`).
- Dashboards mostram obras mais lidas.

### 5.5. Suporte a Novels
**O Problema do Formato**: Novels geralmente não têm páginas estáticas (imagens). Extrair em formato de texto pode ser feito por raspadores simples, mas o desafio é o backend no Telegram. O arquivo gerado precisa ser um formato universal e que preserve formatação mínima.
**Solução - Scraping e Sanitização**:
- O `apps/scraper` de Python vai buscar os elementos de parágrafo `<p>` dentro do contêiner do capítulo do site.
- Vai gerar um HTML simplificado ou um Markdown puro para não perder o itálico e o negrito.
**Solução - Storage no Telegram**:
- O Worker do TypeScript receberá o texto. Se o tipo for `media_type === 'novel'`, ele não fará um loop de imagens.
- Ele pegará o texto bruto, criará um arquivo em memória usando o nome `Manga_Titulo_Cap_X.txt` (ou Markdown).
- Faz o upload via `sendDocument` para o Tópico daquele Manga.
- O banco local vai registrar apenas 1 registro em `LibraryPage` (a página 1) contendo o `file_id` do texto.
**Solução - UI de Leitura**:
- O leitor do Frontend (`ReaderView.jsx`) vai perceber a flag de novel.
- Ele buscará o conteúdo do arquivo de texto via `fetch` pelo link gerado pelo Telegram.
- Ao invés de usar tags `<img>`, usará uma visualização estilo Kindle: texto corrido com um painel de controle flutuante (mudar fundo entre branco, sépia e escuro; alterar tamanho da fonte).

### 5.6. Integração com Trackers (Anilist)
- Ao finalizar a leitura de um capítulo, o backend chama a API do Anilist.
- Atualiza o progresso do usuário automaticamente sem sair do CapDown.

### 5.7. Pre-load Inteligente no Leitor
- O Reader UI (React) terá um worker/hook que faz fetch do próximo capítulo ou das próximas 3 páginas silenciosamente.
- Elimina o tempo de loading ao avançar a página/capítulo.

### 5.8. Rotação de Tokens de Bot (Anti-Rate Limit)
- O backend aceitará múltiplos tokens de bot do Telegram.
- O Upload Service rotacionará entre eles durante downloads paralelos para evitar banimentos (HTTP 429) por excesso de requisições.

### 5.10. Refinamento de Interface Visual
- **Painel de Configuração Avançada:** Aba específica na interface de Configurações onde o usuário gerencia múltiplos Tokens de Bot (lista editável) e verifica a saúde do Tópico raiz do Telegram.
- **Painel de Logs em Tempo Real:** Usar SSE (Server-Sent Events) ou WebSockets do Fastify para enviar o stream de logs de download (ex: "Baixando página 4 de 20") para o frontend sem recarregar a página.
