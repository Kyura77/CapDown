# PLANO DE IMPLEMENTAÇÃO

## 1. Diagnóstico brutal do projeto

**Que produto este repositório parece ser?**  
[CONFIRMADO] CapDown e um app web/mobile para buscar manga/manhwa/novels em provedores externos, baixar capitulos, salvar uma biblioteca offline e ler pelo app. A promessa atual e "Premium Offline Manhwa Library" e "Nuvem (Telegram)".

- **Evidência:** `package.json` — `description: "CapDown - Premium Offline Manhwa Library"`
- **Evidência:** `apps/client/src/pages/Dashboard.jsx:224` — download a partir de `selection.source_url`
- **Evidência:** `apps/client/src/pages/SettingsPage.jsx:310` — UI mostra armazenamento como `Nuvem (Telegram)`

**Qual problema ele tenta resolver?**  
[INFERÊNCIA] Centralizar descoberta, download, armazenamento e leitura offline de obras em um app, reduzindo dependencia manual de sites externos.

**Ele está em qual estágio?**  
[CONFIRMADO] MVP incompleto. O frontend builda, existe API Fastify, Prisma/SQLite e scraper Python parcial, mas fluxos centrais ainda quebram ou sao fakeados.

**O que já funciona?**

- [CONFIRMADO] Build do client Vite passa.
- **Evidência:** comando `npm run build:client` — sucesso.
- [CONFIRMADO] Lint do client passa com 1 warning.
- **Evidência:** comando `npm --workspace @capdown/client run lint` — 0 erros, 1 warning em `MangaDetail.jsx:43`.
- [CONFIRMADO] Rotas HTTP principais existem no backend.
- **Evidência:** `apps/api/src/routes/*.ts` — `/api/search`, `/api/preview`, `/api/downloads`, `/api/library`, `/api/settings`, `/api/auth`, `/v1/scrape`.
- [CONFIRMADO] MangaDex search/preview tem testes passando no suite atual.
- **Evidência:** comando `node --import tsx --test apps/api/test/*.test.ts` — testes MangaDex passaram.
- [CONFIRMADO] Tooling `ralph-loop` passa.
- **Evidência:** comando `npm run ralph:test` — 14 testes passaram.

**O que não funciona?**

- [CONFIRMADO] Typecheck da API falha.
- **Evidência:** `apps/api/src/services/download-worker.ts:113` chama `adapter.getChapterPages(chapter.id, chapter.sourceUrl)`, mas `apps/api/src/providers/types.ts:15` aceita 1 argumento.
- **Evidência:** `apps/api/src/services/telegram-bot.ts:24` usa `new Blob([buffer])`, gerando erro TS2322.
- [CONFIRMADO] Testes de API falham.
- **Evidência:** comando `node --import tsx --test apps/api/test/*.test.ts` — 8 falhas em 12 testes.
- [CONFIRMADO] O fluxo busca -> preview -> download nao importa obra nova para a biblioteca.
- **Evidência:** `apps/client/src/pages/Dashboard.jsx:224` envia apenas `selection.source_url`; `apps/api/src/store/product-state-service.ts:278` procura a URL na biblioteca local; `apps/api/src/store/product-state-service.ts:287` retorna `knownSource: false` se nao encontrar.
- [CONFIRMADO] Telegram nao e integrado de forma confiavel.
- **Evidência:** `apps/api/src/services/download-worker.ts:139` inicia `telegramFileId = 'mock_telegram_file_id'`; `apps/api/src/repositories/prisma-library-repository.ts:271` cria `fakeId`; `apps/api/src/repositories/prisma-library-repository.ts:414` renderiza pagina SVG transicional.

**O que está parcial?**

- [CONFIRMADO] Scraper Python real parcial existe em `apps/scraper`, mas o contrato antigo stub tambem existe em `services/scraper`.
- **Evidência:** `apps/scraper/main.py:9`, `apps/scraper/main.py:24`, `apps/scraper/main.py:39` expõem search/preview/chapter; `services/scraper/app/main.py:18` expõe apenas `/scrape` e retorna `accepted`.
- [CONFIRMADO] Autenticacao foi adicionada por `x-api-key`, mas usa chave dev padrao hardcoded.
- **Evidência:** `apps/api/src/server.ts:69` usa `CAPDOWN_API_KEY || 'dev-key-123'`; `apps/client/src/api/client.js:13` envia `x-api-key: 'dev-key-123'`.
- [CONFIRMADO] Banco existe via Prisma/SQLite, mas infra sobe Postgres/Redis que nao sao usados.
- **Evidência:** `apps/api/prisma/schema.prisma:2` usa `provider = "sqlite"`; `infra/docker-compose.yml:2` e `infra/docker-compose.yml:20` definem Postgres/Redis.

**O que parece fake, mockado ou apenas visual?**

- [CONFIRMADO] `prepareTelegram` marca `telegram_message_id` artificial.
- **Evidência:** `apps/api/src/repositories/prisma-library-repository.ts:271`
- [CONFIRMADO] Download pode completar com `mock_telegram_file_id` quando Telegram nao esta configurado.
- **Evidência:** `apps/api/src/services/download-worker.ts:139`, `apps/api/src/services/download-worker.ts:147`
- [CONFIRMADO] Reader cai em SVG placeholder quando nao ha arquivo Telegram real.
- **Evidência:** `apps/api/src/repositories/prisma-library-repository.ts:399`, `apps/api/src/repositories/prisma-library-repository.ts:414`
- [CONFIRMADO] `syncManga` retorna sempre vazio.
- **Evidência:** `apps/api/src/repositories/prisma-library-repository.ts:294` a `297`
- [CONFIRMADO] "Busca com IA" nao usa IA.
- **Evidência:** `apps/api/src/services/providers.ts:185` retorna `ai_powered: false`.
- [CONFIRMADO] "Recentes" depende de `last_read_at`, mas esse campo nao existe no contrato/banco atual.
- **Evidência:** `apps/client/src/pages/RecentView.jsx:13`; `packages/contracts/src/library.ts:21`; `apps/api/prisma/schema.prisma` nao define `last_read_at`.

**Qual é o maior risco técnico?**  
[CONFIRMADO] O maior risco tecnico e a coexistencia de fluxos transicionais que parecem completos, mas nao sustentam o produto: scraper duplicado, download dependente de biblioteca preexistente, Telegram fake, testes quebrados e typecheck falhando.

**Qual é o maior risco de produto?**  
[CONFIRMADO] A interface promete buscar, baixar, guardar em Telegram e ler offline, mas um usuario novo pode buscar uma obra e falhar no download porque a obra ainda nao existe na biblioteca local.

**Qual é a maior promessa da interface que o código ainda não sustenta?**  
[CONFIRMADO] "Nuvem (Telegram)" como armazenamento real. O token salvo na UI nao alimenta o `TelegramBotService`, e o backend aceita mock/fake como se fosse progresso real.

## 2. Mapa real do sistema

| Área | Status | Arquivos principais | Observações |
|---|---|---|---|
| Frontend | parcial | `apps/client/src/App.jsx`, `apps/client/src/pages/*.jsx`, `apps/client/src/context/*.jsx`, `apps/client/src/api/client.js` | React/Vite/Capacitor. Build passa. Fluxos visuais existem, mas filtros de provedores, recentes, erros e download de obras novas estao inconsistentes. |
| Backend | parcial | `apps/api/src/server.ts`, `apps/api/src/routes/*.ts`, `apps/api/src/store/product-state-service.ts` | Fastify com rotas reais. Typecheck falha. Auth por chave dev hardcoded. |
| Banco/persistência | parcial | `apps/api/prisma/schema.prisma`, `apps/api/src/repositories/prisma-*.ts`, `apps/api/.env` | Prisma usa SQLite `file:./dev.db`. Infra Postgres existe mas nao e usada. Senhas/tokens persistem em claro. |
| Autenticação | parcial | `apps/api/src/server.ts`, `apps/api/src/routes/auth.ts`, `apps/client/src/api/client.js` | API key obrigatoria em mutacoes, mas chave padrao e enviada no bundle. `solveAuth` apenas marca conectado. |
| APIs/rotas | parcial | `apps/api/src/routes/search.ts`, `preview.ts`, `downloads.ts`, `library.ts`, `settings.ts`, `scrape.ts` | Rotas existem. `/v1/scrape` aponta para scraper stub. `/api/search` usa adapters e scraper em outro contrato. |
| Serviços | parcial | `apps/api/src/services/providers.ts`, `download-worker.ts`, `telegram-bot.ts`, `apps/scraper/main.py`, `services/scraper/app/main.py` | Dois scrapers Python coexistem. Download worker usa mock Telegram se token/env nao existir. |
| Jobs/scripts | parcial | `tools/ralph-loop/*`, `apps/api/src/tools/migrate-to-sqlite.ts`, `package.json` | Ralph passa. Migracao SQLite existe. Nao ha fila Redis real. `npm run dev` nao inicia scraper usado por Verdinha/Ego. |
| Testes | parcial | `apps/api/test/*.test.ts`, `tools/ralph-loop/tests/*.mjs` | Ralph passa. API test suite falha por auth e mudanca de providers. Nao ha teste client/e2e. |
| Build/deploy | parcial | `apps/client/vite.config.js`, `.github/workflows/verify.yml`, `infra/docker-compose.yml` | Client builda. CI nao garante tsc porque `npm run build --if-present` pode passar sem build script da API. Deploy real NAO CONFIRMADO. |
| Documentação | parcial | `docs/architecture/*`, `docs/plans/*`, `AUDITORIA_CODIGO.md`, `PLANO_FASE_4.md` | Docs mostram migracao cloud-first, mas varias partes divergem do codigo atual. README raiz ausente; README do client ainda e template Vite. |

## 3. Fluxos reais do produto

### FLUXO-01 — Inicializacao local do produto

- **Objetivo do fluxo:** Subir client, API e servicos necessarios para usar o produto localmente.
- **Onde começa:** `npm run dev`
- **Arquivos envolvidos:** `package.json`, `apps/api/package.json`, `apps/client/package.json`, `apps/scraper/package.json`, `packages/config/src/index.ts`
- **Onde deveria terminar:** Client em Vite, API Fastify e scraper usado por Verdinha/Ego ativos.
- **Status:** parcial
- **Persistência:** parcial
- **Validação:** parcial
- **Tratamento de erro:** parcial
- **Problema encontrado:** `npm run dev` inicia apenas API e client; nao inicia `apps/scraper` na porta 4541. A config `CAPDOWN_V2_SCRAPER_URL` default e 8001, enquanto adapters usam `CAPDOWN_SCRAPER_URL` default 4541.
- **Correção necessária:** Escolher scraper canonico, alinhar env vars/portas e incluir scraper no script dev ou documentar comando obrigatorio.

### FLUXO-02 — Catalogo e filtro de provedores

- **Objetivo do fluxo:** Listar fontes disponiveis e permitir filtrar busca por fonte.
- **Onde começa:** `ProviderCatalogProvider` chama `api.getProviders()`.
- **Arquivos envolvidos:** `apps/api/src/routes/providers.ts`, `apps/api/src/providers/index.ts`, `apps/client/src/context/ProviderCatalogContext.jsx`, `apps/client/src/api/providers.js`, `apps/client/src/pages/Dashboard.jsx`
- **Onde deveria terminar:** Chips de provedores habilitados visiveis no Dashboard.
- **Status:** quebrado
- **Persistência:** não
- **Validação:** parcial
- **Tratamento de erro:** parcial
- **Problema encontrado:** API retorna `status`, mas `normalizeProviderCatalog` descarta `status`; Dashboard filtra `p.status === 'enabled'`, portanto os chips nao aparecem.
- **Correção necessária:** Preservar `status` no normalizador e testar `enabled/unavailable` no client.

### FLUXO-03 — Busca classica e "IA"

- **Objetivo do fluxo:** Buscar obras por texto em provedores.
- **Onde começa:** `Dashboard.handleSearch`.
- **Arquivos envolvidos:** `apps/client/src/pages/Dashboard.jsx`, `apps/api/src/routes/search.ts`, `apps/api/src/services/providers.ts`, `apps/api/src/providers/*.ts`, `apps/scraper/main.py`
- **Onde deveria terminar:** Lista de resultados clicaveis com fontes e capa.
- **Status:** parcial
- **Persistência:** não
- **Validação:** parcial
- **Tratamento de erro:** parcial
- **Problema encontrado:** MangaDex funciona por fetch direto. Verdinha/Ego dependem de `apps/scraper` em 4541, mas o script dev nao sobe esse processo. "IA" retorna `ai_powered: false` e e apenas uma analise textual local.
- **Correção necessária:** Conectar scraper real no fluxo dev/prod e renomear/desativar promessa de IA ate existir servico real.

### FLUXO-04 — Preview de obra

- **Objetivo do fluxo:** Abrir detalhes de uma fonte e listar capitulos antes do download.
- **Onde começa:** `Dashboard.handlePreview` ou URL colada no campo de busca.
- **Arquivos envolvidos:** `apps/client/src/pages/Dashboard.jsx`, `apps/api/src/routes/preview.ts`, `apps/api/src/services/providers.ts`, `apps/api/src/providers/mangadex.ts`, `apps/api/src/providers/verdinha.ts`, `apps/api/src/providers/egotoons.ts`
- **Onde deveria terminar:** `SelectionView` com capitulos e botao de download.
- **Status:** parcial
- **Persistência:** não
- **Validação:** parcial
- **Tratamento de erro:** parcial
- **Problema encontrado:** Preview nao persiste a obra. O passo seguinte de download espera que a obra ja exista na biblioteca.
- **Correção necessária:** Criar fluxo explicito de importacao da obra/chapters antes de enfileirar download, ou fazer `/api/downloads` aceitar payload completo de preview.

### FLUXO-05 — Download de obra/capitulo

- **Objetivo do fluxo:** Baixar paginas, subir para Telegram e atualizar biblioteca.
- **Onde começa:** `Dashboard.handleDownload`.
- **Arquivos envolvidos:** `apps/client/src/pages/Dashboard.jsx`, `apps/api/src/routes/downloads.ts`, `apps/api/src/store/product-state-service.ts`, `apps/api/src/services/download-worker.ts`, `apps/api/src/repositories/prisma-downloads-repository.ts`, `apps/api/src/repositories/prisma-library-repository.ts`
- **Onde deveria terminar:** Job completo, paginas persistidas com `telegram_file_id` real, biblioteca atualizada e reader funcional.
- **Status:** quebrado
- **Persistência:** parcial
- **Validação:** parcial
- **Tratamento de erro:** parcial
- **Problema encontrado:** `createDownload` procura a URL na biblioteca local; se nao achar, cria job `failed`. Isso quebra o principal fluxo de usuario: buscar uma obra nova e baixar.
- **Correção necessária:** Implementar importacao transacional de preview + job, ou endpoint dedicado para "adicionar a biblioteca e baixar".

### FLUXO-06 — Telegram e leitura

- **Objetivo do fluxo:** Usar Telegram como storage e ler paginas no reader.
- **Onde começa:** `SettingsPage.saveTelegram`, `DownloadWorker.processJob`, `ReaderView`.
- **Arquivos envolvidos:** `apps/client/src/pages/SettingsPage.jsx`, `apps/client/src/pages/ReaderView.jsx`, `apps/api/src/services/telegram-bot.ts`, `apps/api/src/services/download-worker.ts`, `apps/api/src/repositories/prisma-library-repository.ts`
- **Onde deveria terminar:** Imagens reais servidas a partir de `telegram_file_id` valido.
- **Status:** fakeado
- **Persistência:** parcial
- **Validação:** parcial
- **Tratamento de erro:** parcial
- **Problema encontrado:** Token salvo em settings nao e usado por `TelegramBotService`; bot usa `CAPDOWN_TELEGRAM_BOT_TOKEN`. Sem env, download usa `mock_telegram_file_id`. `prepareTelegram` cria IDs fake. Reader mostra SVG transicional quando nao consegue arquivo real.
- **Correção necessária:** Unificar origem do token, remover mock como sucesso padrao, fazer `prepareTelegram` real ou remover/renomear a acao.

### FLUXO-07 — Biblioteca, detalhe e reader

- **Objetivo do fluxo:** Listar biblioteca, abrir obra e ler capitulos.
- **Onde começa:** `LibraryProvider`, `MangaDetail`, `ReaderView`.
- **Arquivos envolvidos:** `apps/client/src/context/LibraryContext.jsx`, `apps/client/src/pages/MangaDetail.jsx`, `apps/client/src/pages/ReaderView.jsx`, `apps/api/src/routes/library.ts`, `apps/api/src/repositories/prisma-library-repository.ts`
- **Onde deveria terminar:** Usuario ve paginas reais e progresso persistido.
- **Status:** parcial
- **Persistência:** parcial
- **Validação:** parcial
- **Tratamento de erro:** parcial
- **Problema encontrado:** Funciona somente para dados ja existentes no banco. Sem Telegram real, reader entrega placeholders. Progresso fica apenas em Zustand/localStorage e nao alimenta Recentes.
- **Correção necessária:** Garantir origem real das paginas e persistir progresso/`last_read_at`, ou remover "Recentes" ate existir contrato.

### FLUXO-08 — Settings, credenciais e sessao VIP

- **Objetivo do fluxo:** Configurar API, Telegram, credenciais de provedores e sessao VIP.
- **Onde começa:** `SettingsPage`.
- **Arquivos envolvidos:** `apps/client/src/pages/SettingsPage.jsx`, `apps/api/src/routes/settings.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/repositories/prisma-auth-repository.ts`, `apps/api/prisma/schema.prisma`
- **Onde deveria terminar:** Segredos armazenados de forma segura e sessao real utilizavel por scraper/provider.
- **Status:** parcial
- **Persistência:** sim
- **Validação:** parcial
- **Tratamento de erro:** parcial
- **Problema encontrado:** Senhas ficam em claro; `solveAuth` marca `connected: true` sem captura real; token Telegram salvo no banco nao e usado no upload.
- **Correção necessária:** Definir modelo real de secrets/session, criptografia ou env-only, e conectar sessao ao scraper.

## 4. Bloqueadores reais

### BLOQUEADOR-01 — API nao passa typecheck

- **Prioridade:** P0
- **Área:** build
- **Status:** pendente
- **Evidência no código:** `apps/api/src/services/download-worker.ts:113`; `apps/api/src/providers/types.ts:15`; `apps/api/src/services/telegram-bot.ts:24`
- **Problema real:** O backend tem erro TS2554 por contrato divergente de `getChapterPages` e erro TS2322 no upload Telegram.
- **Impacto prático:** Nao existe baseline confiavel para build/deploy da API. CI deveria bloquear esse estado.
- **Como corrigir:** Ajustar interface `ProviderAdapter.getChapterPages` para aceitar `chapterUrl` ou remover segundo argumento; corrigir conversao Buffer -> Blob/FormData compativel com TypeScript/Node.
- **Critério de aceite:** `npm --workspace @capdown/api exec tsc -- --noEmit` retorna sucesso.
- **Arquivos prováveis:** `apps/api/src/providers/types.ts`, `apps/api/src/providers/egotoons.ts`, `apps/api/src/services/download-worker.ts`, `apps/api/src/services/telegram-bot.ts`
- **Comando de validação:** `npm --workspace @capdown/api exec tsc -- --noEmit`
- **Risco:** médio - toca contratos de provider e upload, mas mudanca e localizada.

### BLOQUEADOR-02 — CI nao valida o typecheck real da API

- **Prioridade:** P0
- **Área:** testes
- **Status:** pendente
- **Evidência no código:** `.github/workflows/verify.yml:25`; `apps/api/package.json:7` a `8`
- **Problema real:** O workflow usa `npm --workspace @capdown/api run build --if-present || npx tsc...`; como nao existe script `build`, `--if-present` pode passar sem executar `tsc`.
- **Impacto prático:** Branch quebrada em TypeScript pode passar no CI.
- **Como corrigir:** Adicionar script `typecheck` ou `build` na API e chamar esse script diretamente no workflow.
- **Critério de aceite:** CI falha quando ha erro TypeScript e passa com API tipada.
- **Arquivos prováveis:** `apps/api/package.json`, `.github/workflows/verify.yml`, `package.json`
- **Comando de validação:** `npm --workspace @capdown/api run typecheck`
- **Risco:** baixo - mudanca de scripts/CI, sem alterar runtime.

### BLOQUEADOR-03 — Scraper duplicado e desconectado do dev/runtime

- **Prioridade:** P0
- **Área:** integração
- **Status:** pendente
- **Evidência no código:** `package.json:11`; `apps/scraper/package.json:6`; `packages/config/src/index.ts:6`; `apps/api/src/providers/verdinha.ts:6`; `services/scraper/app/main.py:18`
- **Problema real:** Existem dois scrapers Python. `apps/scraper` tem endpoints usados pelos adapters em 4541; `services/scraper` e stub `/scrape`; config v2 default aponta para 8001; `npm run dev` nao sobe nenhum scraper.
- **Impacto prático:** Busca/preview/download Verdinha/Ego podem falhar localmente mesmo com API e client rodando.
- **Como corrigir:** Escolher um scraper canonico, mover/mesclar endpoints, alinhar env var e porta, e incluir scraper no script dev ou no README operacional.
- **Critério de aceite:** `npm run dev` ou comando documentado sobe API, client e scraper; busca Verdinha retorna resultado real ou erro controlado.
- **Arquivos prováveis:** `package.json`, `packages/config/src/index.ts`, `apps/api/src/providers/verdinha.ts`, `apps/api/src/providers/egotoons.ts`, `apps/scraper/*`, `services/scraper/*`
- **Comando de validação:** smoke GET/POST em `/api/search?q=teste&providers=verdinha`
- **Risco:** alto - altera contrato entre API e scraper.

### BLOQUEADOR-04 — Download de obra nova falha por exigir biblioteca preexistente

- **Prioridade:** P0
- **Área:** integração
- **Status:** pendente
- **Evidência no código:** `apps/client/src/pages/Dashboard.jsx:224`; `apps/api/src/store/product-state-service.ts:278`; `apps/api/src/store/product-state-service.ts:287`; `apps/api/src/store/product-state-service.ts:301`
- **Problema real:** UI baixa a partir do preview, mas backend so baixa se a obra/capitulo ja estiver na biblioteca local.
- **Impacto prático:** Fluxo central "buscar e baixar" quebra para usuario novo ou biblioteca vazia.
- **Como corrigir:** Persistir preview como `LibraryManga` antes do job, ou alterar `/api/downloads` para receber metadados de fonte/capitulos e criar a entrada transacionalmente.
- **Critério de aceite:** Buscar uma obra nova, selecionar capitulo e iniciar download cria job `queued/downloading`, nao `failed: source_not_found`.
- **Arquivos prováveis:** `apps/client/src/pages/Dashboard.jsx`, `packages/contracts/src/downloads.ts`, `apps/api/src/routes/downloads.ts`, `apps/api/src/store/product-state-service.ts`, `apps/api/src/repositories/prisma-library-repository.ts`
- **Comando de validação:** teste de rota Fastify para `/api/preview` -> `/api/downloads` com obra inexistente.
- **Risco:** alto - mexe em persistencia e contrato de download.

### BLOQUEADOR-05 — Telegram e reader ainda sao fakeados

- **Prioridade:** P0
- **Área:** backend
- **Status:** pendente
- **Evidência no código:** `apps/api/src/services/download-worker.ts:139`; `apps/api/src/services/download-worker.ts:147`; `apps/api/src/repositories/prisma-library-repository.ts:271`; `apps/api/src/repositories/prisma-library-repository.ts:414`
- **Problema real:** O backend pode concluir download com `mock_telegram_file_id`; `prepareTelegram` gera message IDs artificiais; reader pode servir SVG placeholder.
- **Impacto prático:** O produto aparenta baixar e preparar Telegram sem garantir arquivo real. Isso e bug silencioso grave.
- **Como corrigir:** Fazer download falhar quando Telegram nao estiver configurado, exceto flag dev explicita; usar token salvo ou remover campo de token da UI; implementar upload real em `prepareTelegram` ou remover acao fake.
- **Critério de aceite:** Nenhum job `completed` pode conter `mock_telegram_file_id`; reader so marca pagina pronta com `telegram_file_id` real ou exibe erro honesto.
- **Arquivos prováveis:** `apps/api/src/services/download-worker.ts`, `apps/api/src/services/telegram-bot.ts`, `apps/api/src/repositories/prisma-library-repository.ts`, `apps/client/src/pages/SettingsPage.jsx`, `apps/client/src/pages/MangaDetail.jsx`
- **Comando de validação:** teste unitario do worker sem token deve terminar `failed`, nao `completed`.
- **Risco:** alto - altera armazenamento, reader e semantica de sucesso.

### BLOQUEADOR-06 — Autenticacao usa segredo dev embutido no backend e no bundle

- **Prioridade:** P0
- **Área:** segurança
- **Status:** pendente
- **Evidência no código:** `apps/api/src/server.ts:69`; `apps/client/src/api/client.js:13`; `apps/api/src/server.ts:58` a `68`
- **Problema real:** API aceita `dev-key-123` como fallback e o client envia essa chave fixa. GETs de biblioteca/downloads/provedores tambem sao publicos.
- **Impacto prático:** Qualquer pessoa que veja o bundle conhece a chave. Em producao, mutacoes e dados de biblioteca podem ser expostos.
- **Como corrigir:** Remover fallback dev em producao, injetar chave por ambiente seguro para builds locais, definir auth real para app, proteger rotas sensiveis e paginas de media.
- **Critério de aceite:** Sem `dev-key-123` em bundle de producao; API falha no boot se segredo obrigatorio nao existir em ambiente nao-dev.
- **Arquivos prováveis:** `apps/api/src/server.ts`, `apps/client/src/api/client.js`, `apps/client/src/api/runtime.js`, docs de setup
- **Comando de validação:** teste Fastify de auth com/sem header e build grep sem `dev-key-123`.
- **Risco:** alto - altera contratos de acesso entre client e API.

### BLOQUEADOR-07 — Testes de API estao desatualizados e falham

- **Prioridade:** P0
- **Área:** testes
- **Status:** pendente
- **Evidência no código:** `apps/api/test/providers.test.ts:45`; `apps/api/test/providers.test.ts:49`; `apps/api/test/mutants.test.ts:38`; `apps/api/test/mutants.test.ts:74`
- **Problema real:** Testes esperam dois provedores, mas catalogo atual lista todos os conhecidos. Testes mutantes nao enviam API key e recebem 401.
- **Impacto prático:** A suite nao serve como rede de seguranca; nao diferencia regressao real de teste obsoleto.
- **Como corrigir:** Atualizar fixtures para catalogo com `enabled/unavailable`, adicionar helper de auth nos testes protegidos e testar explicitamente 401.
- **Critério de aceite:** `node --import tsx --test apps/api/test/*.test.ts` passa com cobertura de auth/provider atual.
- **Arquivos prováveis:** `apps/api/test/providers.test.ts`, `apps/api/test/mutants.test.ts`, `apps/api/src/providers/index.ts`
- **Comando de validação:** `node --import tsx --test apps/api/test/*.test.ts`
- **Risco:** médio - altera testes e pode revelar bugs reais encobertos.

## 5. Lacunas importantes

### LACUNA-01 — Filtro de provedores no Dashboard nao aparece

- **Prioridade:** P1
- **Área:** frontend
- **Status:** pendente
- **Evidência no código:** `apps/client/src/api/providers.js:27`; `apps/client/src/api/providers.js:39`; `apps/client/src/pages/Dashboard.jsx:350`
- **Problema real:** `status` e descartado no normalizador; UI filtra por `enabled`.
- **Impacto prático:** Usuario nao consegue escolher provedores pela interface.
- **Como corrigir:** Preservar `status` e renderizar tambem indisponiveis como desabilitados ou ocultos com mensagem.
- **Critério de aceite:** Verdinha, MangaDex e Ego Toons aparecem como enabled quando API retorna enabled.
- **Arquivos prováveis:** `apps/client/src/api/providers.js`, `apps/client/src/pages/Dashboard.jsx`, teste unitario do normalizador
- **Comando de validação:** teste JS do normalizador ou e2e visual da tela.
- **Risco:** baixo - mudanca isolada no client.

### LACUNA-02 — Token Telegram salvo na UI nao e usado pelo bot

- **Prioridade:** P1
- **Área:** integração
- **Status:** pendente
- **Evidência no código:** `apps/client/src/pages/SettingsPage.jsx:156`; `apps/api/src/routes/settings.ts:31`; `apps/api/src/services/telegram-bot.ts:7`
- **Problema real:** Settings persistem `telegram_token`, mas `TelegramBotService` usa apenas `CAPDOWN_TELEGRAM_BOT_TOKEN`.
- **Impacto prático:** Usuario pode salvar token e ainda assim upload cair em mock/erro.
- **Como corrigir:** Escolher uma fonte de segredo: banco criptografado ou env-only. Refletir isso na UI.
- **Critério de aceite:** Token configurado pela UI e usado em upload, ou UI deixa claro que token e env-only.
- **Arquivos prováveis:** `apps/api/src/services/telegram-bot.ts`, `apps/api/src/services/download-worker.ts`, `apps/client/src/pages/SettingsPage.jsx`
- **Comando de validação:** teste de upload com service mockado lendo settings.
- **Risco:** alto - envolve segredo e storage.

### LACUNA-03 — Credenciais de provedor ficam em claro

- **Prioridade:** P1
- **Área:** segurança
- **Status:** pendente
- **Evidência no código:** `apps/api/prisma/schema.prisma:31`; `apps/api/src/repositories/prisma-auth-repository.ts:27`; `apps/api/src/repositories/prisma-auth-repository.ts:31`
- **Problema real:** Senhas sao salvas como `String` comum no SQLite.
- **Impacto prático:** Vazamento local ou em backup compromete contas.
- **Como corrigir:** Evitar armazenar senha quando possivel; usar token/sessao; se persistir, criptografar com chave fora do repo e mascarar logs/retornos.
- **Critério de aceite:** Senha nao fica em texto claro no banco ou feature e desabilitada ate haver cofre real.
- **Arquivos prováveis:** `apps/api/prisma/schema.prisma`, `apps/api/src/repositories/prisma-auth-repository.ts`, `apps/client/src/pages/SettingsPage.jsx`
- **Comando de validação:** teste de persistencia verificando que valor bruto nao e gravado.
- **Risco:** alto - mexe em dados sensiveis.

### LACUNA-04 — Postgres/Redis existem na infra mas nao no runtime

- **Prioridade:** P1
- **Área:** arquitetura
- **Status:** pendente
- **Evidência no código:** `infra/docker-compose.yml:2`; `infra/docker-compose.yml:20`; `apps/api/prisma/schema.prisma:2`; `apps/api/prisma/schema.prisma:50`
- **Problema real:** Infra sugere Postgres/Redis, mas API usa SQLite e jobs in-process.
- **Impacto prático:** Arquitetura documentada e runtime real divergem; multi-instancia e jobs resilientes nao sao confiaveis.
- **Como corrigir:** Ou assumir SQLite/local no MVP e remover promessa infra, ou migrar Prisma para Postgres e downloads para fila Redis.
- **Critério de aceite:** `infra:up` e API usam o mesmo banco/fila documentados, ou docs/scripts deixam claro que infra e futura.
- **Arquivos prováveis:** `apps/api/prisma/schema.prisma`, `infra/docker-compose.yml`, `apps/api/src/services/download-worker.ts`, docs
- **Comando de validação:** teste de API contra DATABASE_URL Postgres em ambiente local.
- **Risco:** alto - altera persistencia e dados.

### LACUNA-05 — Recentes nao tem contrato nem persistencia

- **Prioridade:** P2
- **Área:** frontend
- **Status:** pendente
- **Evidência no código:** `apps/client/src/pages/RecentView.jsx:13`; `packages/contracts/src/library.ts:21`; `apps/api/prisma/schema.prisma`
- **Problema real:** UI filtra `last_read_at`, mas esse campo nao e enviado pela API nem existe no schema.
- **Impacto prático:** Aba Recentes fica vazia ou enganosa.
- **Como corrigir:** Persistir progresso/last read no backend ou remover aba ate existir feature real.
- **Critério de aceite:** Abrir reader atualiza `last_read_at` e Recentes mostra a obra, ou aba e removida.
- **Arquivos prováveis:** `apps/client/src/pages/RecentView.jsx`, `apps/client/src/stores/useReaderStore.js`, `packages/contracts/src/library.ts`, `apps/api/prisma/schema.prisma`
- **Comando de validação:** teste de reader/progresso.
- **Risco:** médio - toca UX e persistencia se backend for usado.

### LACUNA-06 — UI usa `alert/confirm` e mensagens de erro inconsistentes

- **Prioridade:** P2
- **Área:** UX
- **Status:** pendente
- **Evidência no código:** `apps/client/src/pages/SettingsPage.jsx:149` a `189`; `apps/client/src/pages/MangaDetail.jsx:73` a `101`; `apps/client/src/pages/Dashboard.jsx:205`
- **Problema real:** Acoes importantes usam bloqueios nativos e parte do client procura `response.data.error`, enquanto API retorna `code/message`.
- **Impacto prático:** Erros reais ficam pouco claros e UX parece prototipo.
- **Como corrigir:** Usar Toast/Modal padronizados e helper unico `extractApiError`.
- **Critério de aceite:** Nenhum fluxo principal depende de `alert/confirm`; mensagens usam `message/code`.
- **Arquivos prováveis:** `apps/client/src/pages/*.jsx`, `apps/client/src/utils/error.js`, `apps/client/src/components/Toast.jsx`
- **Comando de validação:** lint + teste manual de erro 400/401/502.
- **Risco:** baixo - UX isolado.

### LACUNA-07 — Backfill de capas chama provedores externos no boot

- **Prioridade:** P2
- **Área:** performance
- **Status:** pendente
- **Evidência no código:** `apps/api/src/store/product-state-service.ts:82`; `apps/api/src/store/product-state-service.ts:85`; `apps/api/src/store/product-state-service.ts:240`
- **Problema real:** Ao iniciar, API varre biblioteca e chama preview externo para capas faltantes.
- **Impacto prático:** Boot depende de rede/provedor e pode gerar carga desnecessaria.
- **Como corrigir:** Transformar em job manual/assíncrono com limite, cache e observabilidade.
- **Critério de aceite:** Boot nao faz fetch externo automaticamente.
- **Arquivos prováveis:** `apps/api/src/store/product-state-service.ts`, novo job/service opcional
- **Comando de validação:** teste de `init()` sem chamada externa.
- **Risco:** médio - altera comportamento de inicializacao.

### LACUNA-08 — Componentes legados/duplicados ainda coexistem no frontend

- **Prioridade:** P2
- **Área:** frontend
- **Status:** pendente
- **Evidência no código:** `apps/client/src/components/Sidebar.jsx`; `apps/client/src/components/SearchBar.jsx`; `apps/client/src/components/ToastProvider.jsx:2`; busca de uso mostra `Sidebar` e `SearchBar` sem imports ativos.
- **Problema real:** Componentes antigos permanecem sem uso claro; `ToastProvider.jsx` e re-export legado.
- **Impacto prático:** Aumenta risco de alterar componente errado e confunde manutencao.
- **Como corrigir:** Remover arquivos sem uso confirmado ou documentar compatibilidade real.
- **Critério de aceite:** Busca por imports confirma que so componentes renderizados permanecem.
- **Arquivos prováveis:** `apps/client/src/components/Sidebar.jsx`, `SearchBar.jsx`, `ToastProvider.jsx`
- **Comando de validação:** `npm --workspace @capdown/client run lint && npm run build:client`
- **Risco:** baixo - remocao por rastreamento de uso.

## 6. Tarefas de implementação

### TASK P0-01 — Corrigir typecheck da API

- **Status:** pendente
- **Objetivo:** Fazer a API passar em TypeScript strict.
- **Problema atual:** `tsc --noEmit` falha em `download-worker.ts` e `telegram-bot.ts`.
- **Evidência no código:** `apps/api/src/services/download-worker.ts:113`; `apps/api/src/providers/types.ts:15`; `apps/api/src/services/telegram-bot.ts:24`
- **Arquivos para ler primeiro:** `apps/api/src/providers/types.ts`, `apps/api/src/services/download-worker.ts`, `apps/api/src/services/telegram-bot.ts`, `apps/api/src/providers/egotoons.ts`
- **Arquivos prováveis de alteração:** `apps/api/src/providers/types.ts`, `apps/api/src/services/download-worker.ts`, `apps/api/src/services/telegram-bot.ts`, `apps/api/src/providers/egotoons.ts`
- **Passos de implementação:**
  1. Ajustar assinatura de `getChapterPages` para aceitar `chapterSourceId` e opcionalmente `chapterUrl`, ou remover uso do segundo argumento.
  2. Corrigir `sendDocument` para montar `FormData` com tipo compativel com Node/TypeScript.
  3. Rodar typecheck e corrigir qualquer erro derivado.
- **Critério de aceite:** `npm --workspace @capdown/api exec tsc -- --noEmit` passa.
- **Comando de validação:** `npm --workspace @capdown/api exec tsc -- --noEmit`
- **Risco:** médio
- **Dependências:** nenhuma
- **Observações para o agente executor:** Nao introduzir `any` para calar TypeScript. O contrato de provider deve refletir o uso real do worker.

### TASK P0-02 — Tornar CI e scripts raiz honestos

- **Status:** pendente
- **Objetivo:** Garantir que build/test/lint/typecheck executem o que prometem.
- **Problema atual:** Raiz nao tem `build`, `test`, `lint`, `typecheck`; CI pode pular typecheck da API.
- **Evidência no código:** `package.json`; `.github/workflows/verify.yml:25`; comandos raiz `npm run build/test/lint/typecheck` falharam por script ausente.
- **Arquivos para ler primeiro:** `package.json`, `apps/api/package.json`, `apps/client/package.json`, `.github/workflows/verify.yml`
- **Arquivos prováveis de alteração:** `package.json`, `apps/api/package.json`, `.github/workflows/verify.yml`
- **Passos de implementação:**
  1. Adicionar `typecheck` na API chamando `tsc --noEmit`.
  2. Adicionar scripts raiz `build`, `test`, `lint`, `typecheck` que chamem workspaces reais.
  3. Atualizar workflow para chamar scripts diretos, sem `--if-present ||`.
- **Critério de aceite:** Scripts raiz existem e CI falha se API nao tipar.
- **Comando de validação:** `npm run build && npm run lint && npm run typecheck`
- **Risco:** baixo
- **Dependências:** TASK P0-01 para typecheck passar.
- **Observações para o agente executor:** Nao mascarar falhas com `|| true` ou `--if-present` em checagens obrigatorias.

### TASK P0-03 — Atualizar testes da API para o contrato atual

- **Status:** pendente
- **Objetivo:** Recuperar rede de seguranca da API.
- **Problema atual:** 8/12 testes falham por auth e fixtures antigas de providers.
- **Evidência no código:** `apps/api/test/providers.test.ts:45`; `apps/api/test/providers.test.ts:49`; `apps/api/test/mutants.test.ts:38`; `apps/api/test/mutants.test.ts:74`
- **Arquivos para ler primeiro:** `apps/api/test/providers.test.ts`, `apps/api/test/mutants.test.ts`, `apps/api/src/server.ts`, `apps/api/src/providers/index.ts`
- **Arquivos prováveis de alteração:** `apps/api/test/providers.test.ts`, `apps/api/test/mutants.test.ts`
- **Passos de implementação:**
  1. Criar helper de `app.inject` com `x-api-key` para rotas protegidas.
  2. Adicionar testes negativos de 401 sem chave.
  3. Atualizar expectativa de catalogo para providers enabled/unavailable atuais.
  4. Ajustar testes Verdinha para o novo boundary Python scraper ou isolar adapter com URL esperada correta.
- **Critério de aceite:** `node --import tsx --test apps/api/test/*.test.ts` passa.
- **Comando de validação:** `node --import tsx --test apps/api/test/*.test.ts`
- **Risco:** médio
- **Dependências:** TASK P0-01, TASK P0-06 se auth mudar.
- **Observações para o agente executor:** Se teste antigo representava comportamento legado, remova ou renomeie explicitamente. Nao manter teste falso.

### TASK P0-04 — Consolidar scraper canonico e alinhar runtime

- **Status:** pendente
- **Objetivo:** Fazer API, dev script e scraper falarem o mesmo contrato.
- **Problema atual:** `apps/scraper` e `services/scraper` coexistem com endpoints, portas e env vars diferentes.
- **Evidência no código:** `apps/scraper/main.py:9`; `services/scraper/app/main.py:18`; `apps/api/src/providers/verdinha.ts:6`; `packages/config/src/index.ts:6`; `package.json:11`
- **Arquivos para ler primeiro:** `apps/scraper/main.py`, `services/scraper/app/main.py`, `apps/api/src/providers/verdinha.ts`, `apps/api/src/providers/egotoons.ts`, `packages/config/src/index.ts`, `package.json`
- **Arquivos prováveis de alteração:** `package.json`, `packages/config/src/index.ts`, `apps/api/src/providers/*.ts`, `apps/scraper/*` ou `services/scraper/*`
- **Passos de implementação:**
  1. Escolher `apps/scraper` ou `services/scraper` como unico scraper operacional.
  2. Migrar endpoints necessarios para o scraper escolhido.
  3. Alinhar env var e porta usada pela API.
  4. Atualizar `npm run dev` para subir scraper junto ou documentar comando unico.
- **Critério de aceite:** Busca Verdinha/Ego nao falha por scraper offline quando o comando dev oficial esta rodando.
- **Comando de validação:** iniciar stack dev e chamar `/api/search?q=teste&providers=verdinha`.
- **Risco:** alto
- **Dependências:** TASK P0-01
- **Observações para o agente executor:** Nao deixar dois scrapers "por garantia". Se um ficar, marque como legado ou remova apos rastrear uso.

### TASK P0-05 — Implementar importacao de preview antes do download

- **Status:** pendente
- **Objetivo:** Permitir que usuario baixe obra encontrada pela busca sem preexistir na biblioteca.
- **Problema atual:** `/api/downloads` falha se `url` nao existe em `libraryRepo.listLibrary()`.
- **Evidência no código:** `apps/client/src/pages/Dashboard.jsx:224`; `apps/api/src/store/product-state-service.ts:278`; `apps/api/src/store/product-state-service.ts:287`
- **Arquivos para ler primeiro:** `packages/contracts/src/preview.ts`, `packages/contracts/src/downloads.ts`, `apps/api/src/store/product-state-service.ts`, `apps/api/src/repositories/prisma-library-repository.ts`, `apps/client/src/pages/Dashboard.jsx`
- **Arquivos prováveis de alteração:** `packages/contracts/src/downloads.ts`, `apps/api/src/routes/downloads.ts`, `apps/api/src/store/product-state-service.ts`, `apps/client/src/pages/Dashboard.jsx`
- **Passos de implementação:**
  1. Definir contrato de download que aceite `source_url` e metadados minimos da preview, ou criar endpoint `POST /api/library/import`.
  2. Persistir `LibraryManga` e `LibraryChapter` em transacao antes de criar job.
  3. Selecionar capitulos por `source_id` de preview e mapear para IDs internos.
  4. Atualizar UI para enviar metadados necessarios.
- **Critério de aceite:** Com biblioteca vazia, busca -> preview -> baixar cria obra e job nao-failed.
- **Comando de validação:** teste Fastify do fluxo com repository limpo.
- **Risco:** alto
- **Dependências:** TASK P0-04 para providers que dependem de scraper.
- **Observações para o agente executor:** Nao criar entrada incompleta sem criterio. Se page_count ainda for desconhecido, documentar e atualizar quando o scraper retornar paginas.

### TASK P0-06 — Remover sucesso fake no Telegram/reader

- **Status:** pendente
- **Objetivo:** Garantir que sucesso de download signifique arquivo real disponivel.
- **Problema atual:** Mock/fake IDs sao gravados como se fossem Telegram real.
- **Evidência no código:** `apps/api/src/services/download-worker.ts:139`; `apps/api/src/repositories/prisma-library-repository.ts:271`; `apps/api/src/repositories/prisma-library-repository.ts:414`
- **Arquivos para ler primeiro:** `apps/api/src/services/download-worker.ts`, `apps/api/src/services/telegram-bot.ts`, `apps/api/src/repositories/prisma-library-repository.ts`, `apps/client/src/pages/SettingsPage.jsx`
- **Arquivos prováveis de alteração:** `apps/api/src/services/download-worker.ts`, `apps/api/src/services/telegram-bot.ts`, `apps/api/src/repositories/prisma-library-repository.ts`, `apps/client/src/pages/MangaDetail.jsx`, `apps/client/src/pages/SettingsPage.jsx`
- **Passos de implementação:**
  1. Decidir se token vem de env ou banco criptografado.
  2. Fazer worker falhar sem Telegram configurado, salvo flag dev explicita.
  3. Substituir `prepareTelegram` fake por upload real ou remover botao/rota fake.
  4. Ajustar reader para erro honesto quando arquivo nao existe.
- **Critério de aceite:** Nenhuma pagina nova salva `mock_telegram_file_id`; `prepareTelegram` nao gera IDs artificiais.
- **Comando de validação:** teste do worker sem token e teste com `telegramBot` mockado.
- **Risco:** alto
- **Dependências:** TASK P0-05
- **Observações para o agente executor:** Se precisar de modo dev, use flag explicita e UI deve mostrar que e simulado.

### TASK P0-07 — Corrigir autenticacao de produto

- **Status:** pendente
- **Objetivo:** Remover chave dev embutida e definir autenticação minima segura.
- **Problema atual:** `dev-key-123` aparece no backend e no client.
- **Evidência no código:** `apps/api/src/server.ts:69`; `apps/client/src/api/client.js:13`
- **Arquivos para ler primeiro:** `apps/api/src/server.ts`, `apps/client/src/api/client.js`, `apps/client/src/api/runtime.js`, `apps/api/src/routes/*.ts`
- **Arquivos prováveis de alteração:** `apps/api/src/server.ts`, `apps/client/src/api/client.js`, docs de ambiente, testes de auth
- **Passos de implementação:**
  1. Remover fallback de producao para `dev-key-123`.
  2. Ler chave de env/local storage apenas para dev e documentar.
  3. Definir quais GETs podem ser publicos e proteger media/biblioteca se houver dados privados.
  4. Atualizar testes com cenarios 401/200.
- **Critério de aceite:** Build de producao nao contem `dev-key-123`; API falha no boot sem segredo obrigatorio fora de dev.
- **Comando de validação:** grep no bundle + testes Fastify de auth.
- **Risco:** alto
- **Dependências:** TASK P0-03
- **Observações para o agente executor:** Nao chamar chave embutida de "compatibilidade". Isso e segredo publicado.

### TASK P1-01 — Corrigir catalogo de provedores no client

- **Status:** pendente
- **Objetivo:** Exibir filtros de fontes corretamente.
- **Problema atual:** `status` e perdido no normalizador.
- **Evidência no código:** `apps/client/src/api/providers.js:27`; `apps/client/src/pages/Dashboard.jsx:350`
- **Arquivos para ler primeiro:** `apps/client/src/api/providers.js`, `apps/client/src/pages/Dashboard.jsx`, `packages/contracts/src/providers.ts`
- **Arquivos prováveis de alteração:** `apps/client/src/api/providers.js`, `apps/client/src/pages/Dashboard.jsx`
- **Passos de implementação:**
  1. Preservar `status` com fallback `unavailable`.
  2. Renderizar apenas enabled nos filtros ou mostrar unavailable desabilitado.
  3. Adicionar teste simples do normalizador.
- **Critério de aceite:** Filtros mostram providers enabled retornados pela API.
- **Comando de validação:** `npm --workspace @capdown/client run lint && npm run build:client`
- **Risco:** baixo
- **Dependências:** nenhuma
- **Observações para o agente executor:** Nao hardcodar provider no Dashboard; usar catalogo da API.

### TASK P1-02 — Decidir e implementar storage real de segredos

- **Status:** pendente
- **Objetivo:** Eliminar token/senha em claro ou remover feature ate haver cofre real.
- **Problema atual:** `telegram_token` e `AuthAccount.password` ficam no banco sem criptografia.
- **Evidência no código:** `apps/api/prisma/schema.prisma:12`; `apps/api/prisma/schema.prisma:31`
- **Arquivos para ler primeiro:** `apps/api/prisma/schema.prisma`, `apps/api/src/repositories/prisma-auth-repository.ts`, `apps/api/src/repositories/prisma-settings-repository.ts`, `apps/client/src/pages/SettingsPage.jsx`
- **Arquivos prováveis de alteração:** schema Prisma, repositorios de settings/auth, UI settings
- **Passos de implementação:**
  1. Definir politica: env-only, criptografia local, ou remover credenciais persistidas.
  2. Migrar schema e repositorios conforme politica.
  3. Atualizar UI para nao prometer cofre se nao houver cofre.
- **Critério de aceite:** Segredo bruto nao e armazenado sem protecao.
- **Comando de validação:** teste de persistencia e revisao do DB.
- **Risco:** alto
- **Dependências:** TASK P0-06, TASK P0-07
- **Observações para o agente executor:** Nao implementar criptografia sem estrategia de chave fora do repo.

### TASK P1-03 — Alinhar persistencia com infra ou rebaixar promessa de infra

- **Status:** pendente
- **Objetivo:** Remover divergencia SQLite vs Postgres/Redis.
- **Problema atual:** Docker sobe Postgres/Redis, mas API usa SQLite e jobs in-process.
- **Evidência no código:** `apps/api/prisma/schema.prisma:2`; `infra/docker-compose.yml:2`; `infra/docker-compose.yml:20`
- **Arquivos para ler primeiro:** `apps/api/prisma/schema.prisma`, `infra/docker-compose.yml`, `apps/api/src/repositories/*.ts`, `apps/api/src/services/download-worker.ts`
- **Arquivos prováveis de alteração:** schema Prisma, `.env.example`, docs, download worker/fila
- **Passos de implementação:**
  1. Escolher MVP local SQLite ou alvo Postgres/Redis.
  2. Se Postgres, migrar provider Prisma e criar migration.
  3. Se Redis, substituir timers/in-process por fila persistente.
  4. Se SQLite, atualizar docs/infra como futuro.
- **Critério de aceite:** Docs, scripts e runtime apontam para a mesma arquitetura.
- **Comando de validação:** suite API contra banco escolhido.
- **Risco:** alto
- **Dependências:** P0 estabilizado.
- **Observações para o agente executor:** Nao migrar banco antes de recuperar typecheck/testes.

### TASK P1-04 — Tornar "Recentes" uma feature real ou remover

- **Status:** pendente
- **Objetivo:** Evitar aba vazia/falsa.
- **Problema atual:** `RecentView` usa `last_read_at` inexistente.
- **Evidência no código:** `apps/client/src/pages/RecentView.jsx:13`; `packages/contracts/src/library.ts:21`
- **Arquivos para ler primeiro:** `apps/client/src/pages/RecentView.jsx`, `apps/client/src/stores/useReaderStore.js`, `packages/contracts/src/library.ts`, `apps/api/prisma/schema.prisma`
- **Arquivos prováveis de alteração:** `RecentView`, `ReaderView`, `useReaderStore`, contratos, schema Prisma
- **Passos de implementação:**
  1. Decidir se progresso e local ou backend.
  2. Se local, montar Recentes a partir de Zustand persistido.
  3. Se backend, adicionar campos/rota de progresso.
  4. Se nenhum, remover aba.
- **Critério de aceite:** Ler um capitulo faz a obra aparecer em Recentes.
- **Comando de validação:** teste manual/e2e reader -> recentes.
- **Risco:** médio
- **Dependências:** P0-05 se usar biblioteca real.
- **Observações para o agente executor:** Nao adicionar campo no client sem contrato se a API for fonte da biblioteca.

### TASK P1-05 — Padronizar UX de erro e confirmacoes

- **Status:** pendente
- **Objetivo:** Substituir `alert/confirm` e mensagens quebradas por componentes existentes.
- **Problema atual:** UI mistura `toast`, `alert`, `confirm` e leitura de `response.data.error`.
- **Evidência no código:** `apps/client/src/pages/SettingsPage.jsx:149`; `apps/client/src/pages/MangaDetail.jsx:73`; `apps/client/src/pages/Dashboard.jsx:205`
- **Arquivos para ler primeiro:** `apps/client/src/components/Toast.jsx`, `apps/client/src/utils/error.js`, paginas afetadas
- **Arquivos prováveis de alteração:** `Dashboard.jsx`, `MangaDetail.jsx`, `SettingsPage.jsx`, possivel `ConfirmDialog.jsx`
- **Passos de implementação:**
  1. Usar `extractApiError` em todos os catches.
  2. Criar modal de confirmacao reutilizavel ou usar padrao existente.
  3. Trocar alerts por Toast.
- **Critério de aceite:** Nenhum fluxo principal usa `alert`/`confirm`; erros exibem `message` da API.
- **Comando de validação:** `npm --workspace @capdown/client run lint && npm run build:client`
- **Risco:** baixo
- **Dependências:** nenhuma
- **Observações para o agente executor:** Nao misturar refatoracao visual ampla nesta tarefa.

### TASK P2-01 — Remover componentes legados nao usados

- **Status:** pendente
- **Objetivo:** Reduzir duplicidade visual no client.
- **Problema atual:** `Sidebar`, `SearchBar`, `Skeleton` e re-export de `ToastProvider` parecem sobras.
- **Evidência no código:** busca de uso mostra `Sidebar` e `SearchBar` apenas declarados; `ToastProvider.jsx:2` declara re-export legado.
- **Arquivos para ler primeiro:** `apps/client/src/components/*`, `apps/client/src/App.jsx`, `apps/client/src/pages/*`
- **Arquivos prováveis de alteração:** `apps/client/src/components/Sidebar.jsx`, `SearchBar.jsx`, `Skeleton.jsx`, `ToastProvider.jsx`
- **Passos de implementação:**
  1. Confirmar por busca de imports.
  2. Remover arquivos sem uso.
  3. Rodar lint/build.
- **Critério de aceite:** Nenhum import quebrado e menos componentes mortos.
- **Comando de validação:** `npm --workspace @capdown/client run lint && npm run build:client`
- **Risco:** baixo
- **Dependências:** P0/P1 prioritarios concluídos.
- **Observações para o agente executor:** Remover apenas com rastreamento de uso.

### TASK P2-02 — Mover backfill de capas para job explicito

- **Status:** pendente
- **Objetivo:** Evitar I/O externo no boot da API.
- **Problema atual:** `init()` dispara `backfillMissingLibraryCovers`.
- **Evidência no código:** `apps/api/src/store/product-state-service.ts:82`; `apps/api/src/store/product-state-service.ts:85`; `apps/api/src/store/product-state-service.ts:240`
- **Arquivos para ler primeiro:** `apps/api/src/store/product-state-service.ts`, `apps/api/src/services/providers.ts`
- **Arquivos prováveis de alteração:** `product-state-service.ts`, rota/admin opcional, job service opcional
- **Passos de implementação:**
  1. Remover chamada automatica no boot.
  2. Criar comando/rota protegida de backfill com limite.
  3. Testar que `init()` nao chama provider.
- **Critério de aceite:** API sobe sem fetch externo.
- **Comando de validação:** teste unitario de init com provider mockado.
- **Risco:** médio
- **Dependências:** P0-03 para testes.
- **Observações para o agente executor:** Nao perder funcionalidade; apenas mudar gatilho.

### TASK P2-03 — Criar smoke e2e minimo

- **Status:** pendente
- **Objetivo:** Validar fluxo real sem depender de inspecao manual.
- **Problema atual:** Nao ha teste client/e2e.
- **Evidência no código:** `apps/client/package.json` nao possui script de teste; `tests/` esta vazio.
- **Arquivos para ler primeiro:** `apps/client/package.json`, `apps/api/test/*.ts`, `tests/`
- **Arquivos prováveis de alteração:** `package.json`, `tests/e2e/*`, docs de teste
- **Passos de implementação:**
  1. Escolher Playwright ou smoke HTTP + browser simples.
  2. Cobrir health, provider catalog, search mockado, preview e download feliz.
  3. Integrar no script `npm run test`.
- **Critério de aceite:** Smoke roda em CI sem provider externo instavel.
- **Comando de validação:** `npm run test:e2e`
- **Risco:** médio
- **Dependências:** P0 estabilizado.
- **Observações para o agente executor:** Use mocks/controladores locais para nao depender de sites externos no CI.

## 7. Implementações novas que valem a pena

### FEATURE — Importar obra da busca para biblioteca

- **Tipo:** obrigatória
- **Prioridade:** P1
- **Por que vale a pena:** Completa a promessa central de buscar e baixar.
- **Problema que resolve:** Download atual exige obra preexistente.
- **Impacto no usuário:** Usuario consegue sair de biblioteca vazia para obra baixando.
- **Impacto técnico:** Exige contrato de importacao e transacao no backend.
- **Complexidade:** média
- **Risco:** alto
- **Quando implementar:** Como TASK P0-05.
- **Arquivos/camadas afetadas:** Client Dashboard, contratos, routes/downloads, state service, Prisma library repo.
- **Critério de aceite:** Busca -> preview -> baixar funciona em banco vazio.

### FEATURE — Health/status por provedor

- **Tipo:** melhoria
- **Prioridade:** P2
- **Por que vale a pena:** Reduz erro humano e expectativa falsa sobre fontes indisponiveis.
- **Problema que resolve:** Catalogo lista muitos providers, mas poucos adapters reais.
- **Impacto no usuário:** Usuario entende o que funciona agora.
- **Impacto técnico:** Pode reaproveitar `status: enabled/unavailable`.
- **Complexidade:** baixa
- **Risco:** baixo
- **Quando implementar:** Depois de P0-04 e P1-01.
- **Arquivos/camadas afetadas:** Provider catalog API e UI.
- **Critério de aceite:** UI mostra providers enabled/unavailable sem quebrar filtro.

### FEATURE — Fila persistente de downloads

- **Tipo:** melhoria
- **Prioridade:** P2
- **Por que vale a pena:** Aumenta confiabilidade em restart/falhas.
- **Problema que resolve:** Worker atual e in-process.
- **Impacto no usuário:** Downloads nao somem ou ficam inconsistentes apos reinicio.
- **Impacto técnico:** Exige Redis/BullMQ ou alternativa.
- **Complexidade:** alta
- **Risco:** alto
- **Quando implementar:** Depois de typecheck, testes e fluxo download real.
- **Arquivos/camadas afetadas:** `download-worker`, repositorio de downloads, infra Redis, API de progresso.
- **Critério de aceite:** Job retomavel apos restart controlado.

### FEATURE — Progresso de leitura persistido

- **Tipo:** melhoria
- **Prioridade:** P2
- **Por que vale a pena:** Melhora uso recorrente e torna Recentes real.
- **Problema que resolve:** Recentes depende de campo inexistente.
- **Impacto no usuário:** Retomar leitura vira confiavel.
- **Impacto técnico:** Contrato pequeno de progresso ou uso consistente do Zustand local.
- **Complexidade:** média
- **Risco:** médio
- **Quando implementar:** Depois do reader servir paginas reais.
- **Arquivos/camadas afetadas:** Reader, RecentView, store, contratos/API se backend.
- **Critério de aceite:** Abrir capitulo atualiza Recentes.

## 8. Implementações que NÃO devem ser feitas agora

### NÃO FAZER AGORA — Adicionar muitos novos provedores

- **Motivo:** O fluxo com provedores atuais ainda nao esta estavel e download/Telegram estao quebrados.
- **Risco:** Aumenta superficie de falhas e testes externos instaveis.
- **Custo provável:** Alto, porque cada provider precisa search/preview/pages.
- **O que precisa existir antes:** Scraper canonico, contrato de provider e download real.
- **Quando reconsiderar:** Depois de Verdinha, MangaDex e Ego Toons estarem com testes e fluxo real.

### NÃO FAZER AGORA — IA real para busca

- **Motivo:** "AI search" atual e apenas analise local; busca basica ainda depende de scraper instavel.
- **Risco:** Desvia foco do fluxo essencial.
- **Custo provável:** Médio/alto.
- **O que precisa existir antes:** Search/preview/download confiaveis.
- **Quando reconsiderar:** Quando houver logs de consultas e necessidade real de ranking semantico.

### NÃO FAZER AGORA — Refatoracao visual grande

- **Motivo:** UI ja mascara funcionalidades incompletas; melhorar visual nao resolve produto.
- **Risco:** Aumenta diffs e dificulta detectar regressao funcional.
- **Custo provável:** Médio.
- **O que precisa existir antes:** Fluxos P0 funcionando.
- **Quando reconsiderar:** Depois de build/test/download/reader estaveis.

### NÃO FAZER AGORA — Migracao cloud completa antes de estabilizar MVP

- **Motivo:** Postgres/Redis/Telegram real sao importantes, mas typecheck, testes e contratos precisam estar verdes primeiro.
- **Risco:** Quebrar dados e aumentar acoplamento com infra.
- **Custo provável:** Alto.
- **O que precisa existir antes:** Suite API passando e download/importacao definidos.
- **Quando reconsiderar:** Depois de P0-01 a P0-07.

### NÃO FAZER AGORA — App Android release/publicacao

- **Motivo:** Runtime Android aponta para `https://api.capdown.net` sem deploy confirmado e API key dev ainda existe.
- **Risco:** Entregar app que nao conecta ou expoe segredo.
- **Custo provável:** Médio.
- **O que precisa existir antes:** Auth, deploy, API publica e media real.
- **Quando reconsiderar:** Quando smoke web e Android passarem contra ambiente real.

## 9. Ordem exata de execução

1. TASK P0-01 — Corrigir typecheck primeiro porque qualquer mudanca posterior precisa baseline compilavel.
2. TASK P0-02 — Ajustar scripts/CI para impedir que erro de typecheck volte silenciosamente.
3. TASK P0-03 — Atualizar testes para recuperar rede de seguranca antes de mexer em fluxos.
4. TASK P0-04 — Consolidar scraper porque search/preview/download dependem desse boundary.
5. TASK P0-05 — Implementar importacao de preview antes do download, fechando o fluxo central.
6. TASK P0-06 — Remover sucesso fake no Telegram/reader, porque download so vale se arquivo real existir.
7. TASK P0-07 — Corrigir autenticacao, antes de qualquer deploy ou uso fora de dev.
8. TASK P1-01 — Corrigir catalogo/filtro de provedores para UX refletir o backend.
9. TASK P1-02 — Decidir storage seguro de segredos, aproveitando o ajuste de Telegram/auth.
10. TASK P1-03 — Alinhar persistencia/infra depois dos contratos P0 estarem estaveis.
11. TASK P1-04 — Tornar Recentes real ou remover, apos reader/download serem confiaveis.
12. TASK P1-05 — Padronizar UX de erro e confirmacoes.
13. TASK P2-01 — Remover componentes legados sem uso confirmado.
14. TASK P2-02 — Mover backfill de capas para job explicito.
15. TASK P2-03 — Criar smoke e2e minimo.

## 10. Checklist vivo do executor

- [ ] TASK P0-01 — pendente
- [ ] TASK P0-02 — pendente
- [ ] TASK P0-03 — pendente
- [ ] TASK P0-04 — pendente
- [ ] TASK P0-05 — pendente
- [ ] TASK P0-06 — pendente
- [ ] TASK P0-07 — pendente
- [ ] TASK P1-01 — pendente
- [ ] TASK P1-02 — pendente
- [ ] TASK P1-03 — pendente
- [ ] TASK P1-04 — pendente
- [ ] TASK P1-05 — pendente
- [ ] TASK P2-01 — pendente
- [ ] TASK P2-02 — pendente
- [ ] TASK P2-03 — pendente

## 11. Critério de projeto pronto

**Funcionais**

- Busca, preview, importacao, download e reader funcionam em biblioteca vazia.
- Verdinha/MangaDex/Ego Toons exibem status correto e falham de forma honesta quando indisponiveis.
- Download `completed` sempre aponta para paginas reais acessiveis.
- Recentes existe com progresso real ou nao aparece na navegacao.

**Técnicos**

- API passa typecheck strict.
- Client passa build e lint sem erros.
- Testes API passam e cobrem auth, providers, downloads, settings e library.
- Um unico scraper operacional e usado por scripts/dev/docs.

**UX**

- Erros usam mensagens acionaveis.
- Nenhum fluxo principal usa `alert/confirm` nativo.
- Estados loading/error/empty sao distinguiveis.

**Segurança**

- Sem `dev-key-123` em build de producao.
- Segredos nao ficam em claro sem decisao explicita/documentada.
- Rotas de dados privados e media tem auth coerente.

**Performance**

- Boot da API nao depende de fetch externo.
- Downloads tem limite de concorrencia configuravel e sem job in-process perdido sem registro.

**Build/testes**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` existem e passam.
- CI executa os mesmos comandos sem `--if-present` mascarando falhas.

**Documentação mínima**

- README raiz explica setup, envs, scripts e arquitetura real.
- Docs antigas de migracao ficam marcadas como historicas se divergirem do runtime.

## 12. Registro de comandos executados

| Comando | Resultado | Erro principal | Provável causa | Correção sugerida |
|---|---|---|---|---|
| `npm run build` | falha | Missing script: `build` | Raiz nao define script agregado | Criar script raiz real |
| `npm run test` | falha | Missing script: `test` | Raiz nao define script agregado | Criar script raiz chamando suites reais |
| `npm run lint` | falha | Missing script: `lint` | Raiz nao define script agregado | Criar script raiz chamando lint do client e futuros linters |
| `npm run typecheck` | falha | Missing script: `typecheck` | Raiz nao define script agregado | Criar script raiz e script API |
| `npm run build:client` | sucesso |  | Client Vite builda | Manter no CI |
| `npm --workspace @capdown/client run build` | sucesso |  | Client Vite builda | Redundante com `build:client` |
| `npm --workspace @capdown/client run lint` | sucesso com warning | Warning em `MangaDetail.jsx:43` unused eslint-disable | Diretiva antiga sobrou | Remover diretiva |
| `npm --workspace @capdown/api exec tsc -- --noEmit` | falha | TS2554 em `download-worker.ts:113`; TS2322 em `telegram-bot.ts:24` | Contrato `getChapterPages` divergente e Buffer/Blob incompativel | TASK P0-01 |
| `node --import tsx --test apps/api/test/*.test.ts` | falha | 8 falhas em 12 testes | Testes desatualizados para auth/provider/scraper atual | TASK P0-03 |
| `npm run ralph:test` | sucesso |  | Tooling Ralph esta coberto | Manter |
| `npm run check:v2:scraper` | sucesso |  | Compila apenas `services/scraper` stub | Ampliar para scraper canonico |
| `python -m py_compile apps\scraper\main.py apps\scraper\schemas.py apps\scraper\providers\verdinha.py apps\scraper\providers\madara.py apps\scraper\providers\egotoons.py` | sucesso |  | Scraper parcial compila | Incluir em scripts/CI se for canonico |
| `npm --workspace @capdown/api run start -- --help` | interrompido manualmente | Processo iniciou API em `127.0.0.1:4540` e foi encerrado | Comando `start` nao trata `--help`; iniciou servidor real | Nao usar como validacao; criar health smoke dedicado |

## 13. Veredito final

**O projeto está pronto?** não

**Percentual estimado de conclusão:** 55%

**Classificação final:** MVP incompleto

**Próximo passo mais inteligente:** Corrigir typecheck da API e scripts/CI, depois atualizar testes para refletir auth/provider atuais.

**Maior desperdício de tempo agora:** Adicionar novos provedores ou polir UI antes de resolver download/importacao/Telegram real.

**Maior risco de quebrar tudo:** Mexer em persistencia/download/Telegram sem testes verdes e sem resolver o scraper canonico.

**Primeira tarefa que o agente executor deve fazer:** TASK P0-01 — Corrigir typecheck da API.

