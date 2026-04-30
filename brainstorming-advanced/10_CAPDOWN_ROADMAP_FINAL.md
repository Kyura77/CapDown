# 10 — CAPDOWN: Roadmap Final

---

## Sprint 0 — Estabilização de Segurança (1 semana)
**Meta**: Nenhum dado sensível exposto. Sistema não explode sem Redis.

| \# | Tarefa | Arquivo | Prioridade |
|---|--------|---------|------------|
| 0.1 | Remover `dev.db`, `library.db*` do tracking git | `.gitignore` | P0 |
| 0.2 | Verificar que `.env` não está rastreado | `.gitignore` de cada app | P0 |
| 0.3 | API Key obrigatória em produção (process.exit se ausente) | `server.ts` | P0 |
| 0.4 | Fallback de fila in-memory quando Redis offline | `download-queue.ts` | P0 |
| 0.5 | Health check real que expõe estado do Redis e providers | `routes/health.ts` | P0 |

**Critério de pronto**: `git status` não mostra `.db` ou `.env`. App sobe sem Redis com aviso claro. API Key sem fallback inseguro em produção.

---

## Sprint 1 — Contratos e Provider Health (2 semanas)
**Meta**: Cada provider tem contrato testado. Sistema sabe quando provider está quebrado.

| # | Tarefa | Arquivo | Prioridade |
|---|--------|---------|------------|
| 1.1 | Implementar `BaseProvider` ABC | `providers/base.py` | P1 |
| 1.2 | Refatorar 3 providers para implementar `BaseProvider` | `verdinha.py`, `egotoons.py`, `madara.py` | P1 |
| 1.3 | `PageResult` inclui `referer` dinâmico por provider | `schemas.py`, `download-worker.ts` | P0 |
| 1.4 | Fixtures de teste para cada provider | `tests/fixtures/` | P1 |
| 1.5 | Contract tests com pytest + `CAPDOWN_TEST_MODE` | `tests/test_*.py` | P1 |
| 1.6 | Tabela `SourceHealth` + migration | `schema.prisma` | P1 |
| 1.7 | Health check job (BullMQ repeatable, 15 min) | `jobs/health-check-cron.ts` | P1 |
| 1.8 | `GET /api/sources/health` endpoint | `routes/sources.ts` | P1 |
| 1.9 | `GET /api/sources/capabilities` endpoint | `routes/sources.ts` | P2 |
| 1.10 | CI roda contract tests | `.github/workflows/verify.yml` | P1 |

**Critério de pronto**: `pytest apps/scraper/tests/` passa. Verdinha offline aparece em `/api/sources/health`.

---

## Sprint 2 — Schema Migration e Job Granular (2 semanas)
**Meta**: Jobs por capítulo. Migrations versionadas. Retry granular.

| # | Tarefa | Arquivo | Prioridade |
|---|--------|---------|------------|
| 2.1 | `prisma migrate dev --name init_baseline` | `prisma/migrations/` | P1 |
| 2.2 | `ChapterDownloadJob` no schema + migration | `schema.prisma` | P1 |
| 2.3 | `TelegramBotConfig` no schema (multi-bot) | `schema.prisma` | P1 |
| 2.4 | `UrlCache` no schema | `schema.prisma` | P1 |
| 2.5 | Implementar `ChapterDownloadWorker` com idempotência | `services/chapter-download-worker.ts` | P1 |
| 2.6 | Atualizar `ProductStateService.createDownload` para criar N jobs por capítulo | `store/product-state-service.ts` | P1 |
| 2.7 | Endpoint `/api/downloads/:id` retorna status por capítulo | `routes/downloads.ts` | P1 |
| 2.8 | Endpoint `/api/downloads/:id/retry` para capítulo falho | `routes/downloads.ts` | P1 |
| 2.9 | Deprecar (não deletar) `DownloadJob` | Anotação no schema | P1 |
| 2.10 | Testes de integração do worker (resume sem duplicar) | `test/integration/` | P1 |

**Critério de pronto**: Falha no capítulo X não cancela capítulo Y. Job interrompido retoma sem duplicar páginas.

---

## Sprint 3 — Observabilidade e Busca (1.5 semanas)
**Meta**: Logs estruturados. Busca com score real. Cache de URL do Telegram.

| # | Tarefa | Arquivo | Prioridade |
|---|--------|---------|------------|
| 3.1 | Estruturar logs com `request_id`, `operation`, `duration_ms`, `error_kind` | `utils/logger.ts` | P2 |
| 3.2 | `GET /api/metrics` expõe contadores de sistema | `routes/metrics.ts` | P2 |
| 3.3 | SSE para progresso de download | `routes/downloads.ts` | P2 |
| 3.4 | Score de busca: token overlap + Jaro-Winkler | `services/search-ranking.ts` | P1 |
| 3.5 | Deduplicação de resultados por título normalizado | `services/search-ranking.ts` | P1 |
| 3.6 | Rate limit por domínio (`DomainRateLimiter`) | `utils/rate-limiter.ts` | P1 |
| 3.7 | Cache de busca com TTL 5 min | `services/provider-cache.ts` | P2 |
| 3.8 | Proxy `/api/library/page/:pageId` com cache de URL Telegram | `routes/library.ts` | P1 |
| 3.9 | `Retry-After` handling no Telegram bot | `services/telegram-bot.ts` | P1 |
| 3.10 | Busca retorna `sources_status` no response | `routes/search.ts` | P2 |

**Critério de pronto**: Busca por "Berserk" retorna resultado correto primeiro. URL Telegram expirada é renovada automaticamente.

---

## Sprint 4 — Telegram Robusto + Radar (2 semanas)
**Meta**: Downloads resilientes. Novos capítulos detectados automaticamente.

| # | Tarefa | Arquivo | Prioridade |
|---|--------|---------|------------|
| 4.1 | `TelegramStorageService` com compressão e limite 50MB | `services/telegram-storage.ts` | P1 |
| 4.2 | Rotação de bots round-robin (`TelegramBotConfig`) | `services/telegram-storage.ts` | P1 |
| 4.3 | Verificação de suporte a Forum Topics antes de criar | `services/telegram-storage.ts` | P1 |
| 4.4 | Criar/reusar tópico por manga no Telegram | `services/telegram-storage.ts` | P2 |
| 4.5 | Radar job (BullMQ repeatable, 6h) | `jobs/radar-cron.ts` | P2 |
| 4.6 | Notificação Telegram de novos capítulos | `jobs/radar-cron.ts` | P2 |
| 4.7 | Backup DB diário via Telegram | `jobs/backup-cron.ts` | P2 |
| 4.8 | Exportação CBZ | `routes/library.ts` | P2 |
| 4.9 | Quarantine System (`QuarantinedItem` tabela) | `schema.prisma`, `services/quarantine.ts` | P2 |
| 4.10 | Progresso de leitura persistido na API | `routes/library.ts` | P2 |

**Critério de pronto**: Novo capítulo detectado em até 6h. Download de 500MB não falha por limite de bot.

---

## Sprint 5 — Painel Admin e Polimento (1.5 semanas)
**Meta**: Operador consegue ver e agir sobre o sistema sem terminal.

| # | Tarefa | Arquivo | Prioridade |
|---|--------|---------|------------|
| 5.1 | Endpoints admin (`/api/admin/*`) | `routes/admin.ts` | P2 |
| 5.2 | Página `/admin` em React | `client/src/pages/AdminPage.jsx` | P2 |
| 5.3 | Tabela de jobs em execução/falhos com retry inline | `AdminPage.jsx` | P2 |
| 5.4 | Estado de saúde dos providers no painel | `AdminPage.jsx` | P2 |
| 5.5 | Visualizador de quarentena | `AdminPage.jsx` | P2 |
| 5.6 | Badge de status de fonte na UI de busca | `Dashboard.jsx` | P2 |
| 5.7 | Retry automático de imagem expirada no Reader | `ReaderView.jsx` | P1 |
| 5.8 | Documentar endpoints em README atualizado | `README.md` | P3 |
| 5.9 | Remover referências a "Rust/Axum" da documentação | `README.md`, docs | P3 |
| 5.10 | Auditoria e limpeza do plano do agente explorador | `2026-04-27-scraper-explorer-agent-brainstorm.md` | P2 |

---

## O que Adiar (Não é Sprint agora)

| Feature | Motivo |
|---------|--------|
| Anilist OAuth | Projeto separado, sem base para construir ainda |
| Kids Filter | Feature de produto, sem impacto na robustez |
| TomatoDown (Animes) | Stack diferente (MTProto), projeto diferente |
| Canonical Work Graph completo | Depende de base de matching que ainda não existe |
| Auto-Repair Agent com LLM | Depende de contract tests, sandbox, e confiança — tudo em Sprint 1-2 |
| MangaDex/Comick integration | Depois de ter o contrato base funcionando |

---

<table class="markdown-table" style="min-width: 25px;">
<colgroup><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p>co legal.</p></td></tr></tbody>
</table>

---

## Critérios Globais de Pronto

- [ ] Zero arquivos sensíveis no git (`*.db`, `.env`)
- [ ] App sobe e funciona sem Redis (modo degradado)
- [ ] `pytest apps/scraper/tests/` passa em CI
- [ ] `npm test --workspace=apps/api` passa em CI
- [ ] Todos os logs têm `request_id` e `operation`
- [ ] Provider offline aparece em `/api/sources/health`
- [ ] Download interrompido retoma sem duplicar páginas
- [ ] Busca por título exato retorna resultado correto primeiro
- [ ] URL Telegram expirada é renovada automaticamente
- [ ] Falha em capítulo X não cancela capítulo Y

---

## Ordem Correta de Implementação (Resumo)

```
Sprint 0 (Segurança)
  → Sprint 1 (Contratos + Health)
    → Sprint 2 (Schema + Jobs Granulares)
      → Sprint 3 (Observabilidade + Busca)
        → Sprint 4 (Telegram Robusto + Radar)
          → Sprint 5 (Admin + Polimento)
            → (Depois) Canonical Graph
              → (Depois) Auto-Repair Agent
```

Não pular etapas. Sprint 2 sem Sprint 1 = jobs granulares sem contrato = mesmo problema de antes, mais complexo.
