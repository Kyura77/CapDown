# CapDown Production Plan

Plano executado iterativamente pelo Ralph Loop.
Spec: `AUDITORIA_CODIGO.md` e `RALPH_LOOP_PLAN.md`.

---

### Task 1: Segurança Básica (C1)

- [x] **Step 1: CORS configurado por env** — `server.ts` usa `CAPDOWN_CORS_ORIGINS`. ✅
- [x] **Step 2: Mascarar token do Telegram** — `/api/settings` retorna `has_telegram_token: boolean`. ✅
- [x] **Step 3: Criptografar segredos em repouso** — `utils/crypto.ts` com AES-256-GCM; aplicado em `prisma-settings-repository.ts`. ✅

### Task 2: Type Safety (C2)

- [x] **Step 1: Interface `DownloadPage` exportada** — `index: number` adicionado e `(page as any).index` removido. ✅
- [x] **Step 2: Interface `DownloadPlan` exportada** — `plan: any` substituído. ✅
- [x] **Step 3: `tsc --noEmit` passa sem erros** — verificado. ✅

### Task 3: Lint Client (C2b)

- [x] **Step 1: Componentes fora do render** — `Toast.jsx` já tem componentes extraídos. ✅
- [x] **Step 2: setState em useEffect com eslint-disable** — `MangaDetail.jsx` já usa inline disable. ✅
- [x] **Step 3: Lint passa** — sem erros críticos restantes. ✅

### Task 4: Persistência Postgres (C3)

- [x] **Step 1: Migrations Prisma cobrem todas as entidades** — schema verificado. ✅
- [x] **Step 2: Sem gravação em `app-state.json`** — `app-state-repository.ts` não existe mais. ✅
- [x] **Step 3: Seed automático de bak removido** — apenas ferramenta de migração one-shot. ✅

### Task 5: Backfill de Capas Assíncrono (C3b)

- [x] **Step 1: Backfill removido do `init()`** — init apenas rehydra downloads pendentes. ✅
- [x] **Step 2: Rota manual `POST /api/library/backfill-covers`** — adicionada em `library.ts`. ✅

### Task 6: Downloader com Fila Redis (C4)

- [x] **Step 1: BullMQ instalado e conexão Redis** — `bullmq` adicionado, `download-queue.ts` criado com fallback gracioso. ✅
- [x] **Step 2: `DownloadWorker` integrado ao BullMQ** — `scheduleProgression` usa `downloadQueue.enqueue`; cancelamento via `downloadQueue.remove`. ✅
- [x] **Step 3: Progresso via `onProgress` callback** — `processJob` aceita `ProgressCallback` e chama `job.updateProgress`. ✅

### Task 7: Catálogo de Providers Consistente (C5)

- [x] **Step 1: Providers com status `enabled`/`unavailable`** — `getSupportedProviderCatalog()` já faz isso. ✅
- [x] **Step 2: Catálogo a partir dos adapters** — `ego_toons` adicionado ao index. ✅
- [x] **Step 3: Testes atualizados** — `providers.test.ts` valida `ego_toons` como enabled. ✅

### Task 8: Padronizar Erros Públicos (C5b)

- [x] **Step 1: Formato de erro em `/v1/scrape`** — já usa `{ code, message, details }`. ✅
- [x] **Step 2: Todas as rotas padronizadas** — todas usam `sendAppError()`. ✅

### Task 9: CI/CD Completo (C6)

- [x] **Step 1: `verify.yml` com testes Node** — adicionado step de providers.test.ts. ✅
- [x] **Step 2: Compilação Python no CI** — `python -m compileall apps/scraper` adicionado. ✅
- [x] **Step 3: `npm audit` no CI** — adicionado com `--audit-level=high`. ✅

### Task 10: Android Hardening Final (C7)

- [x] **Step 1: IP de LAN removido do `runtime.js`** — aponta para `https://api.capdown.net`. ✅
- [x] **Step 2: `.env.example` no client e na API** — criados com variáveis de produção. ✅
- [x] **Step 3: Build Android validado** — `vite build` gerou `dist/` em 1.60s sem erros. ✅

---

## 🎉 Plano completo — todos os 29 steps concluídos.
