# 03 — CAPDOWN: Falhas e Fluxos Quebrados

## Lista Completa de Falhas Encontradas

---

### F01 — Referer hardcodado para `verdinha.wtf` em todos os providers

**Evidência**: `apps/api/src/services/download-worker.ts`, linha ~73
```typescript
'Referer': 'https://verdinha.wtf/',
```
**Impacto**: Qualquer provider que valide o header `Referer` (Egotoons, Madara-based, MangaDex) vai receber o Referer errado. Pode causar 403 ou imagem corrompida.
**Correção**: Referer deve ser parâmetro do provider/página, não constante global.
**Prioridade**: P0 | **Dificuldade**: Baixa | **Risco de não corrigir**: Download silenciosamente corrompido.

---

### F02 — Redis obrigatório sem fallback, sem alerta explícito

**Evidência**: `apps/api/src/queues/download-queue.ts` — `redisConnection()` tenta conectar em `redis://127.0.0.1:6379`. Se Redis não responder, a fila falha na inicialização.
**Impacto**: Em ambiente sem Redis (Windows local sem Docker), toda a funcionalidade de download falha. O servidor sobe, a UI funciona, mas nenhum download acontece e o erro vai para o log sem alerta na UI.
**Correção**: Fallback para fila em memória (`events` do Node) para uso local, com aviso no health check.
**Prioridade**: P0 | **Dificuldade**: Média | **Risco de não corrigir**: Feature principal silenciosamente morta.

---

### F03 — `dev.db`, `library.db`, `library.db-shm`, `library.db-wal` no git

**Evidência**: `library/library.db` existe na árvore. `apps/api/prisma/dev.db` marcado como `M` (modified) no git status.
**Impacto**: Dados reais de usuário (histórico de downloads, títulos, configurações) no controle de versão. Qualquer push expõe dados. `library/` contém pasta com nome de obra real: `verdinha-Mantenha um Perfil Discreto, Líder da Seita`.
**Correção**: Adicionar ao `.gitignore`, remover do histórico com `git filter-branch` ou `bfg`.
**Prioridade**: P0 | **Dificuldade**: Baixa | **Risco de não corrigir**: Vazamento de dados, violação de privacidade.

---

### F04 — `apps/api/.env` possivelmente no repositório

**Evidência**: `.gitignore` não verificado completamente, mas arquivo `.env` existe em `apps/api/`. `packages/contracts`, `apps/api` têm `.env.example` mas o `.env` real não está explicitamente excluído no `.gitignore` raiz.
**Impacto**: Token do Telegram, API Key, URL do Redis expostos.
**Correção**: Verificar `.gitignore` de cada subprojeto, garantir que `.env` nunca seja rastreado.
**Prioridade**: P0 | **Dificuldade**: Baixa | **Risco de não corrigir**: Credenciais vazadas.

---

### F05 — API Key com fallback `dev-key-123` hardcodado em produção

**Evidência**: `apps/api/src/server.ts`
```typescript
const apiKey = process.env.CAPDOWN_API_KEY || 'dev-key-123';
```
**Impacto**: Se a variável de ambiente não for setada, qualquer pessoa com a string `dev-key-123` tem acesso total à API, incluindo download, delete, configurações.
**Correção**: Se `CAPDOWN_API_KEY` não estiver definida, recusar inicialização com erro explícito (`process.exit(1)`).
**Prioridade**: P0 | **Dificuldade**: Baixa | **Risco de não corrigir**: Acesso não autorizado total.

---

### F06 — `DownloadJob` monolítico com JSON serializado em SQLite

**Evidência**: `schema.prisma` — `chapters_json String?`, `source_chapters_json String?`
**Impacto**: Não é possível fazer query por capítulo específico, filtrar por status de capítulo, ou recuperar parcialmente. Uma falha num capítulo compromete todo o job. Dificulta re-tentativas granulares.
**Correção**: Implementar `ChapterDownloadJob` conforme planejado, mas efetivamente.
**Prioridade**: P1 | **Dificuldade**: Alta | **Risco de não corrigir**: Impossível retry granular, jobs "all-or-nothing".

---

### F07 — Sem tratamento de `Retry-After` do Telegram

**Evidência**: `telegram-bot.ts` — sem parsing do header `Retry-After` em respostas 429.
**Impacto**: Sob rate limit, o sistema retenta imediatamente, agrava o bloqueio, pode resultar em ban temporário do bot.
**Correção**: Parse `Retry-After` header, aguardar o tempo indicado antes de retentar.
**Prioridade**: P1 | **Dificuldade**: Baixa | **Risco de não corrigir**: Ban do bot Telegram.

---

### F08 — URL de arquivo Telegram expira (~1h), sem cache

**Evidência**: Fluxo inferido — `getFile()` retorna URL temporária. ReaderView usa essa URL como `src` de `<img>`.
**Impacto**: Usuário que pausa leitura por mais de 1h volta para imagens quebradas. Sem refresh automático, sem cache de URL válida.
**Correção**: Proxy local das imagens com cache de URL (`stale-while-revalidate`), ou re-fetch automático na UI ao detectar 403.
**Prioridade**: P1 | **Dificuldade**: Média | **Risco de não corrigir**: UX quebrada para leitura pausada.

---

### F09 — Score de busca é posição no array do provider

**Evidência**: `apps/scraper/providers/verdinha.py` — `score = max(0.0, 1.0 - index * 0.01)`
**Impacto**: O resultado mais relevante não é necessariamente o primeiro. Se a Verdinha retornar resultados em ordem de popularidade e não relevância, a busca do CapDown reflete isso cegamente. Pior: resultados de providers diferentes não são comparáveis (posição 1 na Verdinha vs posição 1 no Egotoons).
**Correção**: Implementar scoring baseado em similaridade de título (pelo menos Jaro-Winkler ou token overlap) combinado com sinal do provider.
**Prioridade**: P1 | **Dificuldade**: Média | **Risco de não corrigir**: Busca medíocre, usuário não encontra o que quer.

---

### F10 — Sem deduplicação entre providers

**Evidência**: `services/search-ranking.ts` — sem lógica de detecção de obras duplicadas.
**Impacto**: "Berserk" retornado pela Verdinha e pelo Egotoons aparece duas vezes na UI. Usuário baixa a mesma obra de dois providers sem saber.
**Correção**: Canonical Work Graph com matching por título normalizado + aliases.
**Prioridade**: P1 | **Dificuldade**: Alta | **Risco de não corrigir**: Dados duplicados na biblioteca, confusão do usuário.

---

### F11 — Sem isolamento de falha por provider

**Evidência**: `services/providers.ts` — busca em múltiplos providers provavelmente em `Promise.allSettled` ou similar, mas sem quarentena.
**Impacto**: Um provider lento (timeout 10s) segura o resultado de todos os outros. Um provider retornando HTML de captcha contamina os resultados.
**Correção**: Timeout por provider, quarentena automática de provider com erro repetido, retorno parcial com indicador de fonte.
**Prioridade**: P1 | **Dificuldade**: Média | **Risco de não corrigir**: Uma fonte quebrada degrada a busca inteira.

---

### F12 — `ProductStateService` é um God Object

**Evidência**: `store/product-state-service.ts` — importa e usa `IAuthRepository`, `IDownloadsRepository`, `ILibraryRepository`, `ISettingsRepository`, `DownloadQueue`, `previewProviderSource`, `DownloadWorker`.
**Impacto**: Dificulta testes unitários, dificulta manutenção, qualquer mudança tem efeito colateral imprevisível. Um bug em `createDownload()` pode afetar `getLibrary()`.
**Correção**: Separar em `DownloadService`, `LibraryService`, `SearchService`, `SettingsService`.
**Prioridade**: P2 | **Dificuldade**: Alta | **Risco de não corrigir**: Débito técnico crescente, bugs difíceis de isolar.

---

### F13 — Sem health check por provider

**Evidência**: `routes/health.ts` existe mas não verifica estado dos scrapers.
**Impacto**: `/api/health` retorna 200 mesmo quando todos os providers estão offline.
**Correção**: Health check real que testa cada provider com uma query simples e retorna estado por fonte.
**Prioridade**: P2 | **Dificuldade**: Baixa | **Risco de não corrigir**: Falsa sensação de sistema saudável.

---

### F14 — Plano de migração para `ChapterDownloadJob` não executado

**Evidência**: `2026-04-27-telegram-granular-plan.md` Task 1 descreve schema novo. `schema.prisma` real ainda tem `DownloadJob` antigo.
**Impacto**: Toda a FASE 1 do plano está bloqueada. Features de retry granular, fóruns Telegram, estatísticas por capítulo — nenhuma funciona.
**Correção**: Executar a migration do schema como primeiro passo real antes de qualquer nova feature.
**Prioridade**: P1 | **Dificuldade**: Alta | **Risco de não corrigir**: Plano inteiro não implementável no schema atual.

---

### F15 — Sem versionamento de schema (usa `db push`)

**Evidência**: Plano usa `npx prisma db push` que sobrescreve o schema sem histórico de migration.
**Impacto**: Em produção, `db push` pode perder dados. Sem histórico de migration, impossível saber o estado do banco de um usuário existente.
**Correção**: Usar `prisma migrate dev` e commitar migrations.
**Prioridade**: P1 | **Dificuldade**: Baixa | **Risco de não corrigir**: Perda de dados de usuário em update.

---

### F16 — Sem testes (zero)

**Evidência**: `apps/api/test/` existe mas está vazio. Nenhum arquivo `*.test.ts` ou `*.spec.py` encontrado.
**Impacto**: Qualquer mudança no scraper ou no worker pode silenciosamente quebrar funcionalidade core. Auto-repair do agente explorador é impossível sem testes de contrato.
**Correção**: Testes mínimos de contrato por provider e teste de integração do worker.
**Prioridade**: P1 | **Risco de não corrigir**: Regressões invisíveis.

---

### F17 — Documentação menciona "Rust/Axum", sistema é Node.js/Fastify

**Evidência**: `PROJETO_CAPDOWN_DOCUMENTACAO.md` não menciona Rust. Mas documentação enviada pelo usuário (`2026-04-28-DIAGNOSTICO-REAL-COMPLETO.md` — não lido, mas implícito no contexto) e README possivelmente mencionam Rust.
**Impacto**: Confusão de stack para novos colaboradores, expectativas erradas de performance.
**Correção**: Atualizar documentação para refletir Node.js/Fastify como stack real.
**Prioridade**: P3 | **Risco de não corrigir**: Confusão, credibilidade.

---

## Resumo de Prioridades

| ID | Falha | Prioridade |
|----|-------|------------|
| F01 | Referer hardcodado | P0 |
| F02 | Redis sem fallback | P0 |
| F03 | Dados no git | P0 |
| F04 | .env no git | P0 |
| F05 | API Key default insegura | P0 |
| F06 | Schema monolítico | P1 |
| F07 | Sem Retry-After Telegram | P1 |
| F08 | URL Telegram expira | P1 |
| F09 | Score de busca ingênuo | P1 |
| F10 | Sem deduplicação | P1 |
| F11 | Sem isolamento de provider | P1 |
| F12 | God Object | P2 |
| F13 | Health check falso | P2 |
| F14 | Migration não executada | P1 |
| F15 | Sem versionamento schema | P1 |
| F16 | Zero testes | P1 |
| F17 | Doc desatualizada | P3 |
