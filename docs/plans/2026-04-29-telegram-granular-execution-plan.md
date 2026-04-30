# Telegram Granular Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current coarse download flow with chapter-granular jobs backed by BullMQ and make Telegram storage, progress, and reader integration honest and testable.

**Architecture:** The current code already has partial BullMQ wiring, encrypted settings, and a single-job download model. This plan finishes that migration in three bounded passes: stabilize the current queue + Telegram contract, split the data model into per-chapter jobs with explicit status transitions, then layer premium capabilities only after the base flow is real. The key boundary is strict: `apps/api` orchestrates, `apps/scraper` extracts, Telegram stores media, and the client only reflects persisted state.

**Tech Stack:** Prisma (SQLite now, Redis for queueing), Fastify, TypeScript, React, BullMQ, Python scraper, Telegram Bot API.

---

## Scope

This plan covers the real sub-project hidden inside `2026-04-27-telegram-granular-plan.md`:

- chapter-granular download jobs
- BullMQ queue ownership
- Telegram topic/log integration
- reader/progress integration
- premium follow-ons that still fit the current product

This plan does **not** cover:

- MTProto/userbot storage for 2GB video
- TomatoDown as a separate anime product
- auto-repairing scraper generation
- a Postgres migration unless the chapter-job schema proves SQLite is the blocker

## Current State

### Confirmed codebase facts

- `apps/api/src/queues/download-queue.ts` already exists and starts BullMQ with Redis fallback.
- `apps/api/src/services/download-worker.ts` already processes page downloads and persists `telegram_file_id`.
- `apps/api/src/store/product-state-service.ts` still creates one `StoredDownloadJob` per manga request, not one job per chapter.
- `apps/api/src/repositories/prisma-library-repository.ts` still fakes `prepareTelegram()` by generating `telegram_message_id`.
- `apps/api/src/services/telegram-bot.ts` only supports `sendDocument()` and `getFileUrl()`.
- `apps/client/src/pages/ReaderView.jsx` still assumes page URLs come from `/api/library/pages/TELEGRAM/:chapterId/:index`.
- `apps/client/src/pages/SettingsPage.jsx` already exposes Telegram token/chat config and enabled providers.

### Design constraints from current repo

- Existing UI already speaks in terms of Telegram/cloud storage, so the backend cannot keep fake success semantics.
- `apps/api/prisma/schema.prisma` is already dirty in the workspace, so schema tasks must be isolated and migration-aware.
- Redis is optional in current runtime (`fallback to in-process mode`), which means granular jobs must degrade safely when Redis is absent.
- The current `DownloadJob` shape is still client-visible. Breaking it requires a compatibility layer or a coordinated client update.

## File Map

### Existing files that must remain the authority

- `apps/api/prisma/schema.prisma`
- `apps/api/src/queues/download-queue.ts`
- `apps/api/src/services/download-worker.ts`
- `apps/api/src/services/telegram-bot.ts`
- `apps/api/src/store/product-state-service.ts`
- `apps/api/src/repositories/interfaces.ts`
- `apps/api/src/repositories/prisma-downloads-repository.ts`
- `apps/api/src/repositories/prisma-library-repository.ts`
- `apps/api/src/routes/downloads.ts`
- `apps/api/src/routes/library.ts`
- `packages/contracts/src/downloads.ts`
- `packages/contracts/src/library.ts`
- `packages/contracts/src/settings.ts`
- `apps/client/src/context/DownloadsContext.jsx`
- `apps/client/src/pages/DownloadsPage.jsx`
- `apps/client/src/pages/MangaDetail.jsx`
- `apps/client/src/pages/ReaderView.jsx`
- `apps/client/src/pages/SettingsPage.jsx`

### New files this plan expects

- `apps/api/src/jobs/telegram-log-service.ts`
- `apps/api/src/jobs/radar-cron.ts`
- `apps/api/src/jobs/backup-cron.ts`
- `apps/api/test/download-queue.test.ts`
- `apps/api/test/telegram-bot.test.ts`
- `apps/api/test/granular-downloads.test.ts`
- `apps/client/src/components/DownloadLogPanel.jsx`

## Phases

### Phase 1: Stabilize the existing queue + Telegram contract

Success condition:

- no fake Telegram success
- queue lifecycle observable
- backend type/test baseline green for the touched flow

### Phase 2: Split manga downloads into chapter jobs

Success condition:

- one queue payload per chapter
- one persisted job per chapter
- client can list and reason about granular progress

### Phase 3: Add bounded premium features

Success condition:

- only features that extend the real granular model
- no parallel fake/legacy implementation left behind

## Tasks

### Task 1: Freeze and test the current Telegram boundary

**Files:**
- Modify: `apps/api/src/services/telegram-bot.ts`
- Modify: `apps/api/src/services/download-worker.ts`
- Modify: `apps/api/src/repositories/prisma-library-repository.ts`
- Test: `apps/api/test/telegram-bot.test.ts`
- Test: `apps/api/test/granular-downloads.test.ts`

- [ ] **Step 1: Write failing Telegram contract tests**

Create tests for:

- worker fails job when Telegram is not configured
- worker does not persist `mock_telegram_file_id`
- `prepareTelegram()` no longer reports success with generated fake message IDs

Run:

```powershell
node --import tsx --test apps/api/test/telegram-bot.test.ts apps/api/test/granular-downloads.test.ts
```

Expected: FAIL because current code still allows fake success and fake preparation.

- [ ] **Step 2: Remove fake success semantics**

Implementation target:

- `uploadToTelegram()` must throw a typed failure when token or chat ID is missing
- `prepareTelegram()` must either perform real upload orchestration or return a clear `not_implemented` app error
- reader fallback SVG must remain only as a read-path failure visualization, never as proof of successful storage

- [ ] **Step 3: Re-run the tests**

Run:

```powershell
node --import tsx --test apps/api/test/telegram-bot.test.ts apps/api/test/granular-downloads.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run the API baseline checks**

Run:

```powershell
npm --workspace @capdown/api exec tsc -- --noEmit
node --import tsx --test apps/api/test/*.test.ts
```

Expected: PASS for all touched API checks.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/telegram-bot.ts apps/api/src/services/download-worker.ts apps/api/src/repositories/prisma-library-repository.ts apps/api/test/telegram-bot.test.ts apps/api/test/granular-downloads.test.ts
git commit -m "fix: make telegram storage contract honest"
```

### Task 2: Introduce chapter-granular job persistence

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `packages/contracts/src/downloads.ts`
- Modify: `apps/api/src/repositories/interfaces.ts`
- Modify: `apps/api/src/repositories/prisma-downloads-repository.ts`
- Test: `apps/api/test/granular-downloads.test.ts`

- [ ] **Step 1: Write failing repository tests for chapter jobs**

Test cases:

- a manga request with three chapters creates three persisted jobs
- each job has stable `chapter_id`, `manga_id`, `provider_id`, `status`
- duplicate `(manga_id, chapter_id)` is rejected or deduplicated deterministically

Run:

```powershell
node --import tsx --test apps/api/test/granular-downloads.test.ts
```

Expected: FAIL because the repo still stores a single coarse `DownloadJob`.

- [ ] **Step 2: Update Prisma schema**

Replace the old coarse `DownloadJob` model with a chapter-granular model, keeping only fields the queue and UI truly consume:

- `id`
- `manga_id`
- `manga_title`
- `chapter_id`
- `chapter_title`
- `chapter_number`
- `provider_id`
- `source_url`
- `status`
- `error`
- `downloaded_pages`
- `total_pages`
- `created_at`
- `updated_at`

Also add:

- composite uniqueness on `(manga_id, chapter_id)`
- optional `telegram_topic_id Int?` on `LibraryManga` only if topic ownership is implemented in Task 5

- [ ] **Step 3: Update contracts and repository mapping**

Change:

- `packages/contracts/src/downloads.ts` to expose a chapter-job oriented response model
- `StoredDownloadJob` in `interfaces.ts`
- `prisma-downloads-repository.ts` serialization/deserialization

- [ ] **Step 4: Apply the schema locally**

Run:

```powershell
npx prisma db push --schema apps/api/prisma/schema.prisma
```

Expected: schema applied successfully to local SQLite.

- [ ] **Step 5: Re-run tests and typecheck**

Run:

```powershell
npm --workspace @capdown/api exec tsc -- --noEmit
node --import tsx --test apps/api/test/granular-downloads.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma packages/contracts/src/downloads.ts apps/api/src/repositories/interfaces.ts apps/api/src/repositories/prisma-downloads-repository.ts apps/api/test/granular-downloads.test.ts
git commit -m "feat: persist chapter-granular download jobs"
```

### Task 3: Split `createDownload()` into one plan per chapter

**Files:**
- Modify: `apps/api/src/store/product-state-service.ts`
- Modify: `apps/api/src/routes/downloads.ts`
- Modify: `apps/api/src/services/download-worker.ts`
- Test: `apps/api/test/granular-downloads.test.ts`

- [ ] **Step 1: Write failing service tests**

Test cases:

- `createDownload()` for an entire manga returns an array of queued chapter jobs
- selecting one chapter produces exactly one job
- queue receives one enqueue call per chapter plan

Run:

```powershell
node --import tsx --test apps/api/test/granular-downloads.test.ts
```

Expected: FAIL because `createDownload()` still returns one coarse job.

- [ ] **Step 2: Change the orchestration contract**

Implementation target:

- `buildDownloadPlan()` becomes `buildChapterDownloadPlans()`
- each plan contains one chapter
- each persisted job maps exactly to one BullMQ job
- manga-level aggregate progress becomes a derived client concern, not the persisted queue primitive

- [ ] **Step 3: Update the route response shape**

Choose one shape and keep it consistent:

- `POST /api/downloads` returns `{ status: "queued", jobs: [...] }`

Do not keep both coarse and granular response contracts in parallel.

- [ ] **Step 4: Re-run tests**

Run:

```powershell
npm --workspace @capdown/api exec tsc -- --noEmit
node --import tsx --test apps/api/test/granular-downloads.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/store/product-state-service.ts apps/api/src/routes/downloads.ts apps/api/src/services/download-worker.ts apps/api/test/granular-downloads.test.ts
git commit -m "feat: enqueue one download job per chapter"
```

### Task 4: Adapt the client to chapter-granular downloads

**Files:**
- Modify: `apps/client/src/context/DownloadsContext.jsx`
- Modify: `apps/client/src/pages/DownloadsPage.jsx`
- Modify: `apps/client/src/pages/Dashboard.jsx`
- Modify: `apps/client/src/pages/MangaDetail.jsx`

- [ ] **Step 1: Write the failing UI assumptions down**

Document and verify:

- current UI assumes one row per manga download
- current progress uses `downloaded_chapters / total_chapters`
- manga detail actions assume `prepareTelegram()` is meaningful today

- [ ] **Step 2: Update the client to grouped chapter rows**

Implementation target:

- show one row per chapter job, grouped by manga title
- allow cancel per chapter
- derive aggregate manga progress in the client group renderer instead of requiring coarse backend jobs

- [ ] **Step 3: Remove misleading Telegram action copy**

If `prepareTelegram()` is not yet real after Task 1, disable the button or relabel it to the actual implemented behavior.

- [ ] **Step 4: Validate client build**

Run:

```powershell
npm --workspace @capdown/client run lint
npm --workspace @capdown/client run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/context/DownloadsContext.jsx apps/client/src/pages/DownloadsPage.jsx apps/client/src/pages/Dashboard.jsx apps/client/src/pages/MangaDetail.jsx
git commit -m "feat: show chapter-granular download progress in client"
```

### Task 5: Add Telegram log/topic primitives

**Files:**
- Modify: `apps/api/src/services/telegram-bot.ts`
- Create: `apps/api/src/jobs/telegram-log-service.ts`
- Modify: `apps/api/src/services/download-worker.ts`
- Modify: `apps/api/src/store/product-state-service.ts`
- Test: `apps/api/test/telegram-bot.test.ts`

- [ ] **Step 1: Write failing tests for new Telegram primitives**

Test cases:

- `createForumTopic(chatId, name)` maps the Telegram API response correctly
- `sendMessageWithButtons()` formats inline keyboard payloads correctly
- callback polling registration does not start twice

Run:

```powershell
node --import tsx --test apps/api/test/telegram-bot.test.ts
```

Expected: FAIL because these methods do not exist yet.

- [ ] **Step 2: Implement only the needed Telegram primitives**

Add:

- `createForumTopic(chatId, name)`
- `sendMessageWithButtons(chatId, text, buttons, topicId?)`
- `startPolling(onCallbackQuery)`

Do not implement backup/radar/token rotation in this task.

- [ ] **Step 3: Add a small log service**

`telegram-log-service.ts` should own:

- topic lookup/creation
- structured event text
- retry button payload names

This keeps `download-worker.ts` from becoming the Telegram formatting layer.

- [ ] **Step 4: Wire chapter job lifecycle logs**

Log at:

- queued
- started
- completed
- failed

Use chapter identity, not only manga identity.

- [ ] **Step 5: Re-run tests and typecheck**

Run:

```powershell
npm --workspace @capdown/api exec tsc -- --noEmit
node --import tsx --test apps/api/test/telegram-bot.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/telegram-bot.ts apps/api/src/jobs/telegram-log-service.ts apps/api/src/services/download-worker.ts apps/api/src/store/product-state-service.ts apps/api/test/telegram-bot.test.ts
git commit -m "feat: add telegram logging and topic primitives"
```

### Task 6: Add backup and radar on top of the real granular model

**Files:**
- Create: `apps/api/src/jobs/backup-cron.ts`
- Create: `apps/api/src/jobs/radar-cron.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/repositories/prisma-library-repository.ts`

- [ ] **Step 1: Add backup cron only for the current SQLite reality**

Back up:

- `apps/api/prisma/dev.db`

Send:

- document to the configured Telegram log destination

Run manually first, not only as repeatable schedule.

- [ ] **Step 2: Add radar only for providers with real preview support**

The first supported set should be:

- `verdinha`
- `manga_dex`
- `ego_toons`

Skip unsupported providers explicitly.

- [ ] **Step 3: Reuse `createDownload()`**

Radar must not invent a second download path. It should feed newly discovered chapters back into the same chapter-job API/service path.

- [ ] **Step 4: Validate**

Run:

```powershell
npm --workspace @capdown/api exec tsc -- --noEmit
node --import tsx --test apps/api/test/*.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/jobs/backup-cron.ts apps/api/src/jobs/radar-cron.ts apps/api/src/server.ts apps/api/src/repositories/prisma-library-repository.ts
git commit -m "feat: add telegram backup and chapter radar jobs"
```

### Task 7: Add bounded reader/export improvements

**Files:**
- Modify: `apps/client/src/pages/ReaderView.jsx`
- Modify: `apps/api/src/routes/library.ts`
- Create: `apps/client/src/components/DownloadLogPanel.jsx`

- [ ] **Step 1: Implement reader-side prefetch**

Prefetch only:

- current +1 page
- current +2 pages

Use existing page URLs; do not redesign the reader state model in this task.

- [ ] **Step 2: Add chapter export before full manga export**

Implement the smallest useful export:

- chapter-level CBZ export first

Full manga export can be added after chapter export proves stable.

- [ ] **Step 3: Add a minimal download log panel**

Use polling or server push only after the backend event source exists. If SSE is not already in place, keep this task on polling and log grouping.

- [ ] **Step 4: Validate**

Run:

```powershell
npm --workspace @capdown/client run lint
npm --workspace @capdown/client run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/pages/ReaderView.jsx apps/api/src/routes/library.ts apps/client/src/components/DownloadLogPanel.jsx
git commit -m "feat: add bounded reader prefetch and export tooling"
```

## Deferred Ideas

These came from the brainstorm but should not be part of the first execution wave:

- rotating multiple Telegram bot tokens
- AniList synchronization
- family filter / PIN mode
- auto-pin Telegram messages
- TomatoDown
- MTProto migration

Reason:

- they depend on the granular model being real first
- they increase state surface area without fixing the product’s current main failure modes

## Validation Matrix

- `npm --workspace @capdown/api exec tsc -- --noEmit`
- `node --import tsx --test apps/api/test/*.test.ts`
- `npm --workspace @capdown/client run lint`
- `npm --workspace @capdown/client run build`
- manual smoke: queue one chapter, observe Telegram upload, open reader, cancel one chapter job, verify DB backup job can send a file

## Residual Risks

- SQLite may become awkward once chapter job volume grows.
- Telegram topic creation depends on forum-enabled chats; this must be feature-gated.
- Redis fallback mode must stay honest; if Redis is unavailable, logs should still say the runtime is degraded.
- Reader URL semantics still depend on the current `/api/library/pages/TELEGRAM/...` route shape.

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7

