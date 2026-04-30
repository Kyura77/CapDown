# 07 — CAPDOWN: Schema e Dados

## Problemas de Schema Atuais

### P1 — JSON serializado em colunas SQLite
`DownloadJob.chapters_json`, `source_chapters_json`, `Settings.enabled_providers_json` são strings JSON em colunas `String?`.
- Não dá para fazer query por capítulo específico
- Sem validação de schema pelo banco
- Corrupção silenciosa se JSON for inválido
- Impossível index

### P2 — Ausência de soft delete
`LibraryManga` sem `deleted_at`. Deletar manga remove cascade tudo. Sem recuperação.

### P3 — `LibraryPage` sem `file_size_bytes`
Impossível estimar storage usado. Impossível detectar páginas com tamanho suspeito.

### P4 — `AuthAccount.password` em texto
Comentário no schema: `// Store carefully!`. Não é suficiente. Password deve ser hasheado mesmo sendo local.

### P5 — `Settings` single-row com token único
Um único token Telegram para tudo. Sem suporte a múltiplos bots, sem histórico de configuração.

### P6 — Sem `created_at` em `LibraryChapter`
`downloaded_at` existe mas não é o mesmo que `created_at`. Impossível ordenar por quando o capítulo foi adicionado ao sistema.

---

## Tabelas Novas Sugeridas

### 1. `ChapterDownloadJob` (substituir `DownloadJob`)
```prisma
model ChapterDownloadJob {
  id                  String    @id @default(cuid())
  manga_id            String
  manga_title         String
  chapter_id          String
  chapter_number      String?
  chapter_title       String
  source_url          String
  provider_id         String
  status              String    @default("queued")
  // queued|downloading|uploading|completed|failed|retrying|cancelled
  error               String?
  error_kind          String?   // network|telegram_429|provider_error|too_large|unknown
  retry_count         Int       @default(0)
  max_retries         Int       @default(3)
  downloaded_pages    Int       @default(0)
  total_pages         Int       @default(0)
  uploaded_pages_json String?   // {pageIndex: fileId} — estado de idempotência
  telegram_topic_id   Int?
  telegram_message_id Int?
  priority            Int       @default(5)
  scheduled_at        DateTime  @default(now())
  started_at          DateTime?
  completed_at        DateTime?
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt

  @@unique([manga_id, chapter_id])
  @@index([status, priority, scheduled_at])
}
```

### 2. `SourceHealth` (saúde por provider)
```prisma
model SourceHealth {
  provider_id        String    @id
  status             String    @default("unknown")
  // healthy|degraded|offline|quarantined|unknown
  last_check_at      DateTime?
  last_success_at    DateTime?
  last_error         String?
  error_kind         String?
  error_count_1h     Int       @default(0)
  success_count_1h   Int       @default(0)
  avg_response_ms    Int?
  quarantined_until  DateTime?
  layout_hash        String?   // Hash da estrutura HTML do site
  layout_changed_at  DateTime?
  updated_at         DateTime  @updatedAt
}
```

### 3. `TelegramBotConfig` (multi-bot)
```prisma
model TelegramBotConfig {
  id                  String    @id @default(cuid())
  token               String    // NUNCA exposto em logs
  chat_id             String
  label               String?   // Nome amigável ex: "Bot Principal"
  active              Boolean   @default(true)
  request_count_today Int       @default(0)
  last_used_at        DateTime?
  daily_limit         Int       @default(1000)
  created_at          DateTime  @default(now())
}
```

### 4. `QuarantinedItem` (dados suspeitos)
```prisma
model QuarantinedItem {
  id            String    @id @default(cuid())
  type          String    // search_result|chapter|page|provider_response
  reason        String    // empty_title|invalid_cover|encoding_error|captcha_suspected|repeated_response
  provider_id   String
  source_url    String?
  payload_json  String    // Raw data que foi rejeitado
  created_at    DateTime  @default(now())
  reviewed_at   DateTime?
  disposition   String?   // approved|rejected
  reviewer_note String?
}
```

### 5. `UrlCache` (cache de URLs do Telegram)
```prisma
model UrlCache {
  page_id     String    @id
  url         String
  expires_at  DateTime
  created_at  DateTime  @default(now())
  
  @@index([expires_at])
}
```

### 6. `SelectorConfidence` (confiança por seletor do agente)
```prisma
model SelectorConfidence {
  id          String   @id @default(cuid())
  provider_id String
  selector_id String   // ex: "search_title" | "chapter_url" | "page_img"
  selector    String   // CSS selector ou XPath
  successes   Int      @default(0)
  failures    Int      @default(0)
  last_used_at DateTime?
  updated_at  DateTime @updatedAt
  
  @@unique([provider_id, selector_id])
}
```

---

## Índices Recomendados

```prisma
// LibraryManga — busca frequente por provider+source
@@index([provider_id, source_id])

// LibraryChapter — ordenação por número
@@index([manga_id, number])

// ChapterDownloadJob — processamento da fila
@@index([status, priority, scheduled_at])
@@index([manga_id])

// QuarantinedItem — revisão por tipo e data
@@index([type, provider_id, created_at])

// UrlCache — limpeza de expirados
@@index([expires_at])
```

---

## Migrações Recomendadas

### Sequência correta (não use `db push`):

```bash
# 1. Gerar migration do estado atual
npx prisma migrate dev --name init_baseline

# 2. Cada feature nova: migration nomeada
npx prisma migrate dev --name add_chapter_download_job
npx prisma migrate dev --name add_source_health
npx prisma migrate dev --name add_telegram_bot_config
npx prisma migrate dev --name add_quarantine
npx prisma migrate dev --name add_url_cache

# 3. Em produção: apenas
npx prisma migrate deploy
```

### Migration de dados (DownloadJob → ChapterDownloadJob):
```sql
-- Executar manualmente após migration de schema
-- Não é possível automatizar sem lógica de negócio
-- Jobs em estado final (completed/failed) podem ser arquivados
-- Jobs em estado pendente devem ser recriados manualmente
```

---

## Riscos do SQLite

### Quando SQLite basta ✅
- CapDown é personal software — 1 usuário, 1 instância
- Leitura pesada, escrita moderada (downloads assíncronos)
- Sem necessidade de concurrent writers de múltiplos processos
- BullMQ já usa Redis separado para fila — SQLite não vira gargalo de jobs

### Quando SQLite NÃO basta ⚠️
- **Múltiplos workers simultâneos** escrevendo na mesma tabela: SQLite usa file lock — workers podem travar esperando unlock
- **WAL mode**: ativar `PRAGMA journal_mode=WAL` (não padrão no Prisma/SQLite) para melhorar concorrência
- **Backup durante escrita**: risco de banco corrompido se backup sem WAL
- **Biblioteca > 10.000 obras**: performance de full-text search SQLite degrada sem FTS5

### Configurações recomendadas para SQLite no Prisma:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```
```typescript
// No bootstrap do Prisma:
await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;');
await prisma.$executeRawUnsafe('PRAGMA synchronous=NORMAL;');
await prisma.$executeRawUnsafe('PRAGMA foreign_keys=ON;');
await prisma.$executeRawUnsafe('PRAGMA cache_size=-64000;'); // 64MB cache
```

---

## Entidades Canônicas

O schema atual tem `LibraryManga` que mistura "obra na biblioteca" com "referência de busca". Separar:

```
CanonicalWork (obra canônica, sem provider)
  id, primary_title, alternative_titles_json, authors_json, year, genre_json
  ↑
  SourceMapping (mapeamento provider → canonical)
    provider_id, source_id, confidence, evidence_json
  ↑
LibraryManga (obra na biblioteca do usuário)
  canonical_id (FK para CanonicalWork, nullable para manter compatibilidade)
  provider_id, source_id (mantido por compatibilidade)
```

Implementar gradualmente: `canonical_id` nullable inicialmente, matching retroativo em background job.
