# 02 — CAPDOWN: Mapa Arquitetural

## Arquitetura Atual Inferida

```
┌─────────────────────────────────────────────────────────────────────┐
│  Cliente (React + Capacitor)                                        │
│  apps/client/src/                                                   │
│  - Dashboard.jsx  MangaDetail.jsx  ReaderView.jsx  SettingsPage.jsx │
│  - Zustand (useReaderStore) + localStorage persist                  │
│  - Zod contracts via @capdown/contracts                             │
└────────────────────┬────────────────────────────────────────────────┘
                     │ HTTP (REST + x-api-key)
                     │ SSE planejado mas não implementado
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API — Node.js + Fastify  (apps/api/src/)                           │
│                                                                     │
│  Routes:                                                            │
│  /api/search  /api/library  /api/downloads  /api/settings          │
│  /api/preview  /api/scrape  /api/providers  /api/health  /api/auth  │
│                                                                     │
│  Services:                                                          │
│  ProductStateService ─── DownloadQueue (BullMQ)                    │
│  SearchRanking ─────────── providers (egotoons / verdinha / mdex)  │
│  TelegramBot ───────────── sendDocument (file_id como storage key) │
│  DownloadWorker ─────────── Semaphore + fetchWithRetry             │
│                                                                     │
│  Repositories (Prisma/SQLite):                                      │
│  Settings | AuthSession | AuthAccount | DownloadJob | Library      │
└────────┬────────────────────────┬───────────────────────────────────┘
         │                        │
         ▼                        ▼
┌────────────────┐     ┌──────────────────────────────┐
│  Redis         │     │  Scraper (Python/FastAPI)    │
│  (BullMQ dep)  │     │  apps/scraper/               │
│  Obrigatório   │     │  providers/                  │
│  Sem fallback  │     │  - verdinha.py               │
└────────────────┘     │  - egotoons.py               │
                       │  - madara.py                 │
                       └──────────┬───────────────────┘
                                  │ HTTP interno
                                  │ /search /preview /chapters
                                  ▼
                       ┌──────────────────────┐
                       │  Sites externos      │
                       │  verdinha.wtf        │
                       │  egotoons.com        │
                       │  sites Madara        │
                       └──────────────────────┘

Storage: Telegram API
telegram_file_id = chave primária de cada página armazenada
```

---

## Módulos Existentes

| Módulo | Localização | Estado |
|--------|-------------|--------|
| API Server | `apps/api/src/server.ts` | Funcional |
| Download Worker | `apps/api/src/services/download-worker.ts` | Funcional com gaps |
| Download Queue | `apps/api/src/queues/download-queue.ts` | Funcional, depende Redis |
| Product State Service | `apps/api/src/store/product-state-service.ts` | Funcional, God Object |
| Search Ranking | `apps/api/src/services/search-ranking.ts` | Implementado, ingênuo |
| Telegram Bot | `apps/api/src/services/telegram-bot.ts` | Funcional |
| Scraper Python | `apps/scraper/` | Funcional, 3 providers |
| Contratos Zod | `packages/contracts/src/` | Funcional |
| Cliente React | `apps/client/src/` | Funcional |
| Android (Capacitor) | `apps/client/android/` | Configurado |
| Ralph Loop | `tools/ralph-loop/` | Ferramenta de dev, não é produto |

---

## Fluxo de Dados — Download

```
UI (MangaDetail) 
  → POST /api/downloads (jobId, mangaId, chapterIds[])
  → ProductStateService.createDownload()
  → DownloadQueue.enqueue(DownloadPlan)
  → BullMQ → Worker.processJob()
    → para cada capítulo:
      → ScraperClient.getPages(chapterUrl) → Python scraper
      → para cada página:
        → fetchWithRetry(pageUrl) → Buffer
        → TelegramBot.sendDocument(buffer) → file_id
        → LibraryRepo.savePage(file_id)
      → DownloadsRepo.updateProgress()
  → UI polling /api/downloads/:id
```

**Ponto fraco**: polling de UI é manual. Sem SSE/WebSocket, a UI não sabe quando o job terminou sem fazer request.

---

## Fluxo de Busca

```
UI (Dashboard)
  → GET /api/search?q=titulo&providers[]=verdinha
  → routes/search.ts
  → services/providers.ts → ScraperClient (HTTP para Python)
  → Python scraper → verdinha.py/egotoons.py/madara.py
  → UnifiedSearchResult[]
  → SearchRanking.rank(results, query)
    → normalizeText + tokenize
    → score = posição_no_array (FALHA AQUI)
    → sort por score
  → SearchResponse para UI
```

**Ponto fraco**: score é baseado em posição no array de retorno do provider. Sem TF-IDF, sem Jaro-Winkler, sem aliases.

---

## Fluxo de Leitura

```
UI (ReaderView) 
  → GET /api/library/:mangaId/chapters/:chapterId
  → LibraryRepo.getChapterWithPages()
  → readerChapterPayloadSchema (Zod)
    → pages: [{index, telegram_file_id}]
    → prev_chapter / next_chapter (pré-computados)
  → UI: para cada página visível:
    → GET /api/library/file/:telegram_file_id
    → TelegramBot.getFile(file_id) → URL efêmera
    → img src = URL efêmera Telegram
```

**Ponto fraco**: URL do Telegram expira (1h). Se usuário pausar leitura e voltar depois, imagens quebram. Sem cache.

---

## Fluxo de Matching / Deduplicação

**Não existe.** Não há lógica para detectar que "Berserk" na Verdinha e "Berserk" no Egotoons são a mesma obra. Cada provider retorna resultados independentes. A UI apresenta duplicatas.

---

## Fluxo Telegram

```
TelegramBot.sendDocument(buffer, filename, chatId)
  → FormData multipart
  → POST api.telegram.org/bot{token}/sendDocument
  → retorna file_id (string)
  → salvo em LibraryPage.telegram_file_id

TelegramBot.getFile(file_id)
  → GET api.telegram.org/bot{token}/getFile
  → retorna file_path
  → URL: https://api.telegram.org/file/bot{token}/{file_path}
  → URL expira em ~1h
```

**Pontos fracos**:
- Token único. Sem rotação de bots (planejada, não implementada).
- Rate limit do Telegram não tratado — sem `Retry-After` parsing.
- Sem tópicos (forum topics) — todas as páginas vão pro mesmo chat.
- Sem backup do `file_id` — se o bot for deletado, todos os dados somem.

---

## Pontos de Acoplamento Críticos

| Acoplamento | Risco | Localização |
|-------------|-------|-------------|
| Redis obrigatório sem fallback | Alto | `download-queue.ts` |
| Telegram token único | Alto | `telegram-bot.ts` |
| Referer hardcodado `verdinha.wtf` | Médio | `download-worker.ts:L73` |
| `ProductStateService` acessa 4 repos diretamente | Alto | `product-state-service.ts` |
| Python scraper via HTTP no mesmo processo de request | Médio | `clients/scraper.ts` |
| `dev.db` e `library.db` no git | Alto | `library/` + `apps/api/prisma/` |

---

## Sugestões de Separação

1. **Extrair `SourceRegistry`** — mapeamento de providers deve ser isolado, não espalhado por `providers/index.ts` + `services/providers.ts`.
2. **Extrair `TelegramStorageService`** do `TelegramBotService` — bot (notificações) e storage (file upload) são responsabilidades distintas.
3. **Extrair `JobScheduler`** do `ProductStateService` — que hoje é um God Object com 7 responsabilidades.
4. **Isolar `HealthMonitor`** — hoje não existe; deve ser um módulo próprio.
5. **Separar contrato de `SearchResult` de `LibraryManga`** — hoje misturados no mesmo schema Zod.
