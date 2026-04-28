# Ralph Loop Plan – CapDown Production Modernization

**Objetivo**: Consolidar todo o estado da auditoria de código (`AUDITORIA_CODIGO.md`) e transformar as recomendações em um plano de ação iterativo usando o *Ralph Loop* já presente em `tools/ralph-loop`. O objetivo é garantir que as decisões, prioridades e responsáveis fiquem centralizados, versionados e rastreáveis ao longo das próximas sprints.

---

## 1. Visão Geral do Contexto
- **Escopo auditado**: `apps/api`, `apps/client`, `packages/contracts`, `services/scraper`, `infra`, `tools/ralph-loop` e artefatos locais.
- **Principais problemas críticos** (listados na auditoria):
  - Falta de autenticação/autorização nas rotas sensíveis.
  - Persistência em JSON local vulnerável; necessidade de migração para Postgres/Redis.
  - Downloads ainda “local‑first” e incompletos para providers fora a Verdinha.
  - API sem type‑check confiável (falha no `download‑worker.ts`).
  - Segurança – credenciais em texto claro, CORS aberto, cleartext HTTP no Android.
  - Divergência entre o contrato de providers e os adapters reais.
- **O que já foi concluído** (Fase 4): integração real com Telegram, motor Madara, CI pipeline, hardening Android, etc.

---

## 2. Estrutura do Ralph Loop
O *Ralph Loop* divide o processo em ciclos de **Collect → Analyze → Synthesize → Execute → Review**. Cada ciclo gera artefatos de estado (`iteration‑prompt.md`, `current‑run.json`) que podem ser versionados ou ignorados conforme a necessidade.

### 2.1. Collect (Coleta)
1. **Reunir todas as regras de negócio**: contratos em `packages/contracts`, adapters em `apps/api/src/providers`, e schema do scraper.
2. **Inventariar recursos críticos**: tabelas do Prisma, filas Redis (a criar), endpoints Fastify, arquivos `.env`.
3. **Capturar contexto operacional**: variáveis de ambiente (`CAPDOWN_TELEGRAM_BOT_TOKEN`, `CAPDOWN_API_URL`), docker‑compose services, estado atual do `Ralph Loop` (`tools/ralph-loop/state/*`).

### 2.2. Analyze (Análise)
- **Mapeamento de risco**: cruzar as vulnerabilidades listadas na auditoria com a criticidade dos fluxos (auth, download, settings).
- **Gap analysis** entre o contrato de providers (`providerIdSchema`) e os adapters implementados (`verdinhaAdapter`, `egoToonsAdapter`).
- **Impacto de migração** de JSON → Postgres: identificar tabelas, chaves estrangeiras e processos de seed.
- **Avaliar dependências externas** (Telegram API, providers externos) – timeout, retry, rate‑limit.

### 2.3. Synthesize (Síntese)
- Criar **Backlog Prioritário** (categorias: Urgente, Médio, Longo Prazo) – já está no final da auditoria.
- Definir **Objetivos de Sprint** (ex.: Sprint 1 – Auth + TypeCheck; Sprint 2 – Persistência Postgres; Sprint 3 – Downloader Redux + Redis Queue).
- Especificar **Definições de Done** para cada história (tests unitários, lint, CI pass, documentação).

### 2.4. Execute (Execução)
- **Implementar** as tarefas do backlog seguindo a ordem de prioridade.
- **Commit & PR**: cada tarefa deve gerar PR independente, com CI rodando typecheck, lint, testes.
- **Atualizar o Ralph Loop**: após cada PR merge, gerar novo `iteration‑prompt.md` descrevendo o que mudou, riscos residuais e próximos passos.

### 2.5. Review (Revisão)
- **Retrospectiva** ao final de cada ciclo: comparar o *plan* versus o *outcome* (ex.: `current‑run.json` contém estado final).
- **Ajustar** prioridades e redefinir metas para o próximo ciclo.
- **Documentar** lições aprendidas no diretório `docs/ralph-loop/`.

---

## 3. Plano de Ação – Ciclos Propostos
| Ciclo | Objetivo Principal | Tarefas Chave (PR) | Responsável | Prazo (dias) |
|------|--------------------|-------------------|------------|--------------|
| **C1** | **Segurança Básica** | • Middleware `auth` nas rotas mutantes (Fastify preHandler).<br>• Remover `origin: true` e definir CORS por env.<br>• Criptografar `settings.telegram_*` no DB (libsodium ou similar). | @dev‑sec | 5 |
| **C2** | **Type Safety** | • Corrigir tipagem em `download‑worker.ts` (definir `DownloadPage` interface).<br>• Executar `npm run check` em todo monorepo.<br>• Atualizar contratos de provider (`ProviderAdapter` → `getChapterPages(chapterId:string, sourceUrl?:string)`). | @dev‑ts | 4 |
| **C3** | **Persistência Real** | • Criar migrations Prisma para `library_page` com `telegram_file_id`.<br>• Migrar `AppStateRepository` → `PostgresRepository` (settings, auth, library).<br>• Desativar escrita em `app-state.json`.
| @dev‑db | 7 |
| **C4** | **Downloader Redesign** | • Introduzir fila Redis (`bullmq`) para jobs de download.<br>• Refatorar `DownloadWorker` → `TelegramDownloaderService` que consome pages do Scraper e faz upload direto.
| @dev‑dl | 8 |
| **C5** | **Scraper Expansion** | • Implementar **MadaraProvider** fully (already done) e registrar no Python scraper.<br>• Atualizar `providers/index.ts` para usar `getProviderAdapter` genérico (já aplicado).<br>• Testes de integração Node ↔ Python.
| @dev‑scr | 6 |
| **C6** | **CI/CD & Observability** | • Integrar CI pipeline completa (`verify.yml` já existe).<br>• Adicionar jobs de lint, typecheck, test e build para todos os workspaces.<br>• Exportar métricas (Prometheus) e logs estruturados.
| @dev‑ops | 5 |
| **C7** | **Android Hardening** | • Remover `cleartext` e usar HTTPS only.<br>• Configurar `androidScheme: "https"` (feito).<br>• Testar em emulator.
| @dev‑mobile | 3 |

> Cada ciclo deve terminar gerando um **iteration‑prompt.md** (descrição do que foi entregue) e atualizar **current‑run.json** (estado do loop). Esses arquivos permanecem sob `.gitignore` conforme política do Ralph Loop.

---

## 4. Como Usar o Ralph Loop no Projeto
1. **Inicializar**: copie o diretório `tools/ralph-loop/template` para `tools/ralph-loop/state/` (já existe). Certifique‑se de que `state/.gitkeep` está presente e que todo o conteúdo `state/*` está listado no `.gitignore`.
2. **Primeiro Run**:
   ```bash
   cd tools/ralph-loop
   npm run start   # ou comando definido no package.json
   ```
   O script criará `iteration-prompt.md` com a descrição acima.
3. **Após cada PR**: rode novamente o loop; ele lerá `current-run.json`, comparará com a base e produzirá um novo artefato de iteração.
4. **Revisão**: abra `tools/ralph-loop/state/current-run.json` para visualizar o progresso total. Use o campo `status` (e.g., "in‑progress", "completed").

---

## 5. Próximos Passos Imediatos
- **[ ]** Criar o arquivo `tools/ralph-loop/state/current-run.json` (vazio) e garantir que está ignorado.
- **[ ]** Commitar este `RALPH_LOOP_PLAN.md` na raiz.
- **[ ]** Iniciar o Ciclo 1 (Segurança Básica) conforme a tabela acima.
- **[ ]** Atualizar o `README.md` com link para o plano e instruções do Ralph Loop.

---

**Nota**: Este plano está pensado para ser evolutivo; à medida que o Ralph Loop gera novos prompts, ajuste o backlog e as prioridades. Boa implementação!
