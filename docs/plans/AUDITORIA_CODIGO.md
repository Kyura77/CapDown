# Auditoria Profissional de Codigo

Data da auditoria: 2026-04-26  
Escopo inspecionado: `apps/api`, `apps/client`, `packages/contracts`, `packages/config`, `services/scraper`, `infra`, `tools/ralph-loop`, raiz do repo e artefatos locais relevantes.

## 1. Resumo Executivo

[CONFIRMADO] O projeto esta em estado de migracao ativa, nao em estado de producao. A estrutura principal ja aponta para `apps/api` + `apps/client` + `services/scraper` + `packages`, mas a implementacao real ainda mistura persistencia local, estado transitorio em JSON, provider logic dentro da API Node, scraper Python stub, docs antigas de Rust e tooling/scratch solto na raiz.

[CONFIRMADO] A maior ameaca tecnica atual e a divergencia entre arquitetura desejada e comportamento real: o produto comunica Telegram/cloud-first, mas downloads gravam em `library/` local, o reader serve SVG placeholder, `prepare-telegram` apenas marca IDs artificiais, settings e credenciais ficam em JSON local e nao ha autenticacao/autorizacao nas rotas publicas.

[RISCO] Nao esta pronto para producao. O projeto pode ser usado para iteracao local, mas ainda tem riscos graves de seguranca, perda/inconsistencia de dados, API sem protecao, build quebrado no backend e UX que mascara falhas como vazio/nao encontrado.

## 2. Nota Geral do Projeto

| Area | Nota | Justificativa |
| --- | ---: | --- |
| Arquitetura | 4/10 | Boa direcao de pastas (`apps`, `services`, `packages`), mas implementacao real ainda e transitoria e conflita com o plano cloud-first. |
| Qualidade do codigo | 5/10 | Ha uso de schemas Zod e alguma separacao de rotas/servicos, mas existem arquivos grandes, responsabilidades misturadas e comentarios de fallback/stub. |
| Seguranca | 2/10 | API sem auth, CORS aberto, credenciais em JSON local, HTTP cleartext no Android e ausencia de rate limit/hardening. |
| Performance | 4/10 | Busca profunda e backfill fazem chamadas externas sem timeout/circuit breaker; persistencia em arquivo reescreve estado inteiro; polling de downloads no client. |
| Manutenibilidade | 4/10 | Contratos centralizados ajudam, mas contratos listam providers que nao existem na API; docs e estado de migracao estao divergentes. |
| Testabilidade | 3/10 | Existem testes de providers e Ralph loop, mas faltam testes de rotas mutantes, persistencia, client, e2e, auth e downloads reais. |
| UX/DX | 4/10 | Client builda, mas lint falha; estados de erro sao inconsistentes e ha `alert/confirm` em fluxo principal. |
| Prontidao para producao | 2/10 | Typecheck da API falha, backend nao usa Postgres/Redis/Telegram real e nao ha controles basicos de seguranca. |

## 3. Problemas Criticos

### [CRITICO] API publica sem autenticacao/autorizacao para operacoes sensiveis

- **Arquivo(s):**
  - `apps/api/src/server.ts:21`
  - `apps/api/src/routes/settings.ts:8`
  - `apps/api/src/routes/settings.ts:17`
  - `apps/api/src/routes/auth.ts:7`
  - `apps/api/src/routes/auth.ts:24`
  - `apps/api/src/routes/library.ts:52`
  - `apps/api/src/routes/downloads.ts:28`
- **Trecho/area afetada:** Fastify registra CORS com `origin: true`; rotas de settings, auth, biblioteca e downloads nao exigem usuario, sessao, token, CSRF ou permissao.
- **Problema:** Qualquer cliente que alcance a API pode ler settings, salvar token/chat do Telegram, salvar credenciais de provider, marcar sessao VIP, deletar manga e deletar downloads.
- **Impacto real:** Vazamento/alteracao de credenciais, exclusao de biblioteca, sequestro de configuracao e abuso de chamadas externas.
- **Como corrigir:** Implementar autenticacao no `apps/api` antes das rotas mutantes; restringir CORS por origem; exigir permissao por operacao; adicionar CSRF se mantiver cookies; validar origem em ambiente Android/Web.
- **Prioridade:** Alta

### [CRITICO] Credenciais e tokens persistidos em texto claro no estado local

- **Arquivo(s):**
  - `apps/api/src/repositories/app-state-repository.ts:27`
  - `apps/api/src/repositories/app-state-repository.ts:195`
  - `apps/api/src/repositories/app-state-repository.ts:204`
  - `apps/api/src/repositories/app-state-repository.ts:419`
  - `apps/api/src/repositories/app-state-repository.ts:433`
  - `apps/api/src/repositories/app-state-repository.ts:439`
  - `apps/api/src/repositories/app-state-repository.ts:447`
  - `apps/api/data/app-state.json:3`
- **Trecho/area afetada:** `StoredAuthAccount.password`, `settings.telegram_token`, `settings.telegram_chat_id` e `apps/api/data/app-state.json`.
- **Problema:** O backend grava senha e token diretamente no JSON de estado. O arquivo esta ignorado no `.gitignore`, mas existe dentro do workspace local.
- **Impacto real:** Vazamento local ou acidental em backup/zip/log/sync. Se o processo for comprometido, nao ha camada de protecao em repouso.
- **Como corrigir:** Remover senha como modelo padrao; usar provider sessions/tokens de curta duracao; criptografar segredos em repouso com chave fora do repo; nunca devolver `telegram_token` inteiro em GET; mascarar/rotacionar.
- **Prioridade:** Alta

### [CRITICO] Persistencia principal e arquivo JSON local, nao Postgres/Redis/Telegram

- **Arquivo(s):**
  - `apps/api/src/repositories/app-state-repository.ts:342`
  - `apps/api/src/repositories/app-state-repository.ts:343`
  - `apps/api/src/repositories/app-state-repository.ts:349`
  - `apps/api/src/repositories/app-state-repository.ts:358`
  - `apps/api/src/repositories/app-state-repository.ts:380`
  - `infra/docker-compose.yml:1`
- **Trecho/area afetada:** `statePath` em `apps/api/data/app-state.json`; `legacySeedPath` em `library/index.json.bak`; Docker sobe Postgres/Redis, mas API nao usa esses servicos.
- **Problema:** O plano alvo fala Postgres/Redis, mas a API reescreve um JSON inteiro e ainda re-semeia de backup legado se o estado novo sumir.
- **Impacto real:** Corrupcao em crash durante escrita, perda de atualizacoes entre multiplas instancias, impossibilidade de escala horizontal, ressurgimento de obras legadas quando `app-state.json` e removido.
- **Como corrigir:** Criar schema Postgres e repositorios transacionais; mover jobs para Redis; migrar dados uma vez; remover leitura automatica de `library/index.json.bak` apos migracao; manter backup apenas via comando explicito.
- **Prioridade:** Alta

### [CRITICO] Downloads ainda sao local-first e incompletos para providers nao Verdinha

- **Arquivo(s):**
  - `apps/api/src/services/download-worker.ts:103`
  - `apps/api/src/services/download-worker.ts:106`
  - `apps/api/src/services/download-worker.ts:126`
  - `apps/api/src/services/download-worker.ts:128`
  - `apps/api/src/repositories/app-state-repository.ts:684`
  - `apps/api/src/repositories/app-state-repository.ts:726`
- **Trecho/area afetada:** `DownloadWorker`, `prepareTelegram`, reader page serving.
- **Problema:** O worker so busca paginas reais quando `sourceProviderId === 'verdinha'`; outros providers recebem `pages = []`. As paginas sao escritas em `process.cwd()/library/...`, enquanto o Telegram e apenas simulado por IDs incrementais. O reader gera SVG placeholder, nao midia real.
- **Impacto real:** Downloads de MangaDex/outros providers podem concluir sem baixar conteudo; UI comunica nuvem/Telegram, mas o dado real fica local ou inexistente.
- **Como corrigir:** Transformar download em job real com fila Redis; mover page extraction para `services/scraper`; upload real para Telegram; persistir `telegram_file_id` real; falhar explicitamente quando provider nao tem extractor.
- **Prioridade:** Alta

### [CRITICO] Backend API nao passa typecheck

- **Arquivo(s):**
  - `apps/api/src/services/download-worker.ts:101`
  - `apps/api/src/services/download-worker.ts:115`
- **Trecho/area afetada:** variavel `pages` no worker.
- **Problema:** `npm --workspace @capdown/api exec tsc -- --noEmit` falha com `TS7034` e `TS7005` por `pages` implicitamente `any[]`.
- **Impacto real:** O backend nao tem baseline tipado confiavel; CI deveria bloquear merge/deploy nesse estado.
- **Como corrigir:** Tipar contrato de pagina baixavel no adapter (`DownloadPage`), remover `any` do `plan`, retornar erro quando provider nao implementa `getChapterPages`.
- **Prioridade:** Alta

### [CRITICO] Catalogo de providers divergente do contrato publico

- **Arquivo(s):**
  - `packages/contracts/src/index.ts:3`
  - `packages/contracts/src/index.ts:4`
  - `packages/contracts/src/index.ts:5`
  - `packages/contracts/src/index.ts:6`
  - `packages/contracts/src/index.ts:22`
  - `apps/api/src/providers/index.ts:6`
  - `apps/api/test/providers.test.ts:36`
- **Trecho/area afetada:** `providerIdSchema` lista 19 providers; `providerAdapters` registra somente Verdinha e MangaDex; teste confirma apenas esses dois.
- **Problema:** O contrato aceita IDs que a API nao suporta. A UI pode listar/validar mentalmente providers inexistentes ou rejeitar selecoes de forma surpreendente.
- **Impacto real:** Regressao funcional percebida pelo usuario: providers antigos somem; busca fica limitada; downloads/preview de providers sem adapter falham.
- **Como corrigir:** Separar `knownProviderId` de `enabledProviderId`; catalogo deve vir de adapters reais; adicionar stubs explicitos com status `unavailable` ou implementar adapters restantes.
- **Prioridade:** Alta

## 4. Problemas Importantes

### [ALTO] `services/scraper` e stub e nao cumpre responsabilidade arquitetural

- **Arquivo(s):** `services/scraper/app/main.py:20`, `services/scraper/app/main.py:21`, `services/scraper/app/schemas.py:7`
- **Problema:** `/scrape` apenas retorna `status="accepted"` com provider/url/mode. Nao ha scraping, browser automation, cookies, capitulo, paginas ou contratos ricos.
- **Impacto:** A API Node continua carregando provider logic e download logic, mantendo acoplamento que o plano queria remover.
- **Acao recomendada:** Definir contratos Python/Node para `search`, `preview`, `chapters`, `pages`; implementar provider adapters no scraper; API apenas orquestra.

### [ALTO] Erro publico inconsistente em `/v1/scrape`

- **Arquivo(s):** `apps/api/src/routes/scrape.ts:13`, `apps/api/src/store/errors.ts:23`
- **Problema:** A maioria dos erros segue `code/message/details`; `/v1/scrape` responde `error/details`.
- **Impacto:** Cliente/tooling precisam tratar dois formatos de erro; quebra o contrato definido.
- **Acao recomendada:** Padronizar todos os erros com `apiErrorSchema`.

### [ALTO] CORS aberto e Android cleartext/hardcoded LAN

- **Arquivo(s):** `apps/api/src/server.ts:21`, `apps/client/capacitor.config.ts:8`, `apps/client/capacitor.config.ts:9`, `apps/client/src/api/runtime.js:4`
- **Problema:** API aceita qualquer origin; Android permite trafego claro e fixa `192.168.100.14`.
- **Impacto:** Funciona localmente, mas e fragil fora da maquina do desenvolvedor e amplia superficie de ataque.
- **Acao recomendada:** Configurar origins por ambiente, HTTPS em producao, discovery/config por env, e remover IP pessoal como default.

### [ALTO] Busca e preview dependem de chamadas externas sem timeout/abort/rate limit

- **Arquivo(s):** `apps/api/src/providers/verdinha.ts:160`, `apps/api/src/providers/verdinha.ts:171`, `apps/api/src/providers/mangadex.ts:147`, `apps/api/src/providers/mangadex.ts:163`, `apps/api/src/services/providers.ts:43`
- **Problema:** `fetch` nao recebe timeout/AbortController; busca profunda faz ate 5 paginas por provider.
- **Impacto:** Uma Verdinha/MangaDex lenta pode prender request, degradar API e criar gargalo sob uso paralelo.
- **Acao recomendada:** Introduzir HTTP client com timeout, retry controlado, circuit breaker por provider, cache curto e limites por usuario/IP.

### [ALTO] Backfill de capas roda no boot e faz I/O externo

- **Arquivo(s):** `apps/api/src/store/product-state-service.ts:66`, `apps/api/src/store/product-state-service.ts:217`, `apps/api/src/store/product-state-service.ts:226`
- **Problema:** Ao iniciar, o backend tenta preencher capas faltantes chamando preview externo para cada manga sem capa.
- **Impacto:** Boot fica dependente de provider externo; falhas podem atrasar/subir parcialmente; grande biblioteca aumenta custo.
- **Acao recomendada:** Mover backfill para job explicito/assíncrono com cache, limite e retry; nao bloquear init.

### [MEDIO] Arquivos grandes concentram responsabilidades demais

- **Arquivo(s):** `apps/api/src/repositories/app-state-repository.ts` com 721 linhas; `apps/api/src/store/product-state-service.ts` com 322 linhas; `apps/client/src/pages/SettingsPage.jsx` com 299 linhas; `packages/contracts/src/index.ts` com 274 linhas.
- **Problema:** Persistencia, normalizacao de legado, integridade, Telegram fake, reader e SVG placeholder estao no mesmo repositorio.
- **Impacto:** Mudancas pequenas tem alto risco lateral e dificultam testes unitarios.
- **Acao recomendada:** Separar `legacy-importer`, `settings-repository`, `library-repository`, `reader-service`, `telegram-service`, `download-service` e schemas por dominio.

### [MEDIO] Frontend mascara erro como estado vazio/nao encontrado

- **Arquivo(s):** `apps/client/src/context/LibraryContext.jsx:22`, `apps/client/src/context/ProviderCatalogContext.jsx:29`, `apps/client/src/pages/MangaDetail.jsx:39`, `apps/client/src/pages/ReaderView.jsx:78`
- **Problema:** Falhas de API viram `console.error`, lista vazia ou "Obra nao encontrada".
- **Impacto:** Usuario nao sabe se falhou backend, rota, rede ou dado inexistente.
- **Acao recomendada:** Criar estado `loading/error/empty` padronizado por contexto e mensagens acionaveis.

### [MEDIO] Client lint falha

- **Arquivo(s):** `apps/client/src/components/Toast.jsx`, `apps/client/src/components/ToastProvider.jsx`, `apps/client/src/pages/DownloadsPage.jsx`, `apps/client/src/pages/ReaderView.jsx`
- **Problema:** `npm --workspace @capdown/client run lint` retornou 6 erros e 1 warning, incluindo componente criado durante render e `setState` sincrono em effect.
- **Impacto:** DX ruim e risco de comportamento instavel em React.
- **Acao recomendada:** Extrair componentes internos, separar hook/context exports, ajustar carregamento do reader.

### [MEDIO] Scratch/testes manuais estao versionados na raiz

- **Arquivo(s):** `test-api.js`, `test-ddg.js`, `test-parse.js`
- **Problema:** Scripts ad hoc de pesquisa Verdinha/DuckDuckGo vivem no root, fora de `tests/` ou `tools/`.
- **Impacto:** Raiz perde previsibilidade e scripts podem ser confundidos com teste oficial.
- **Acao recomendada:** Mover para `tools/research/verdinha` ou remover; criar testes automatizados reais quando util.

### [MEDIO] Estado do Ralph loop esta versionado

- **Arquivo(s):** `tools/ralph-loop/state/current-run.json`, `tools/ralph-loop/state/iteration-prompt.md`
- **Problema:** `git ls-files` confirmou esses arquivos como rastreados; estado de execucao deveria ser runtime.
- **Impacto:** Noise em diffs, vazamento de prompt/contexto e reproducibilidade enganosa.
- **Acao recomendada:** Manter apenas `.gitkeep`; ignorar `tools/ralph-loop/state/*` exceto `.gitkeep`.

## 5. Melhorias Recomendadas

### Curto prazo

- Bloquear mutacoes sensiveis atras de auth minima no `apps/api`.
- Parar de retornar token inteiro em `/api/settings`; retornar apenas `has_telegram_token`.
- Corrigir typecheck da API e lint do client antes de novas features.
- Remover `frontend/` gerado, scripts scratch da raiz e estado rastreado do Ralph loop.
- Trocar `providerIdSchema` para refletir providers habilitados ou expor status por provider.
- Fazer download falhar explicitamente para provider sem extractor, em vez de concluir com zero paginas.

### Medio prazo

- Migrar `AppStateRepository` para Postgres com transacoes e migrations.
- Mover jobs para Redis com fila, cancelamento persistente e progresso consistente.
- Implementar `services/scraper` real com contratos validados.
- Criar `HttpProviderClient` com timeout, retry, rate limit e user-agent controlado.
- Separar modulos do client por feature: search, library, downloads, settings, reader.
- Criar suite de testes de rotas Fastify com `buildServer()` e repositorio isolado.

### Longo prazo

- Implementar Telegram media store real ou renomear produto para nao prometer Telegram-first.
- Adicionar CI com typecheck, lint, testes Node, compile Python, build client, audit e e2e.
- Criar modelo de permissao/usuario/sessao para ambiente multi-user.
- Adicionar observabilidade: request id, logs estruturados sem segredos, metricas por provider/job.
- Validar Android com emulator e remover dependencia de IP LAN hardcoded.

## 6. Refatoracoes Prioritarias

### 1. Trocar persistencia JSON por repositorios Postgres

- **O que refatorar:** `AppStateRepository` e chamadas em `ProductStateService`.
- **Por que refatorar:** Hoje o estado inteiro e normalizado e regravado em arquivo, sem transacao real.
- **Como fazer:** Criar migrations para `settings`, `auth_sessions`, `library_manga`, `library_chapters`, `library_pages`, `download_jobs`; migrar leitura/gravação por dominio.
- **Risco da mudanca:** Alto, toca todos os fluxos.
- **Beneficio esperado:** Durabilidade, consistencia, escala e fim do ressurgimento de legado por seed.

### 2. Extrair provider/scraper boundary

- **O que refatorar:** `apps/api/src/providers/*`, `apps/api/src/services/providers.ts`, `services/scraper`.
- **Por que refatorar:** API publica esta fazendo scraping/provider fetching diretamente.
- **Como fazer:** Scraper expor `search`, `preview`, `chapterPages`; API chama client tipado e aplica ranking/contrato publico.
- **Risco da mudanca:** Medio/alto por depender de providers externos.
- **Beneficio esperado:** Isolamento, testes melhores, possibilidade de browser automation sem contaminar API.

### 3. Reescrever pipeline de downloads

- **O que refatorar:** `DownloadWorker`, `createDownload`, `prepareTelegram`, reader page delivery.
- **Por que refatorar:** Fluxo atual mistura download local, stubs e Telegram fake.
- **Como fazer:** Redis job -> scraper pages -> download stream -> Telegram upload -> Postgres pages -> reader URL real.
- **Risco da mudanca:** Alto.
- **Beneficio esperado:** Produto passa a cumprir promessa Telegram/cloud-first.

### 4. Dividir client em features

- **O que refatorar:** `Dashboard.jsx`, `SettingsPage.jsx`, `MangaDetail.jsx`, contextos.
- **Por que refatorar:** Paginas contem regra de negocio, chamadas API, estado, dialogs e render.
- **Como fazer:** Criar `features/search`, `features/library`, `features/downloads`, `features/settings`, com hooks e componentes menores.
- **Risco da mudanca:** Medio.
- **Beneficio esperado:** Menos regressao visual/funcional e melhor testabilidade.

### 5. Consolidar contratos por dominio

- **O que refatorar:** `packages/contracts/src/index.ts`.
- **Por que refatorar:** Um unico arquivo concentra todos os schemas e permite divergencia entre provider conhecido e provider habilitado.
- **Como fazer:** Separar `providers.ts`, `search.ts`, `library.ts`, `downloads.ts`, `settings.ts`, `auth.ts`, `errors.ts`.
- **Risco da mudanca:** Baixo/medio.
- **Beneficio esperado:** Contratos mais claros e imports mais especificos.

## 7. Seguranca

### Vulnerabilidades encontradas

- [CONFIRMADO] API sem autenticacao/autorizacao em rotas sensiveis.
- [CONFIRMADO] CORS permissivo com `origin: true`.
- [CONFIRMADO] Senhas de provider e token/chat do Telegram persistidos em JSON local sem criptografia.
- [CONFIRMADO] Android permite `cleartext: true` e navega para IP LAN especifico.
- [CONFIRMADO] Rotas que fazem fetch externo nao possuem timeout, rate limit ou politica centralizada.
- [RISCO] `/api/preview` aceita URL do usuario. Ha mitigacao parcial porque adapters filtram host por `canHandleUrl`, mas ainda falta timeout, limite de tamanho, controle de redirect e rate limit.
- [RISCO] Logs podem expor URLs de pagina/CDN em falha: `download-worker.ts:141` loga `Failed to download page ${page.url}`.

### Secrets expostos

- [CONFIRMADO] Nao ha `.env` rastreado (`git ls-files '*.env' '.env*'` nao retornou arquivos).
- [CONFIRMADO] `apps/api/data/app-state.json` contem chaves `telegram_token` e `telegram_chat_id`, atualmente nulas, mas o codigo grava valores reais ali.
- [CONFIRMADO] `docs/research/verdinha-index-0PA2-Lrc.js` esta rastreado; e bundle de terceiro copiado para docs. Nao vi segredo evidente nele durante a busca por tokens, mas e artefato de pesquisa grande e deve ser removido ou documentado.

### Recomendacoes de hardening

- Adicionar middleware de auth, rate limit e request size limit.
- Usar `@fastify/helmet` ou headers equivalentes.
- Configurar CORS por env, nunca `origin: true` em producao.
- Criptografar segredos em repouso e mascarar respostas.
- Remover `cleartext: true` fora de debug.
- Sanitizar logs e nunca logar URLs assinadas, tokens, headers ou payloads de auth.

## 8. Performance

### Gargalos encontrados

- `AppStateRepository.persist` reescreve todo `app-state.json` em cada mutacao (`apps/api/src/repositories/app-state-repository.ts:380`).
- `backfillMissingLibraryCovers` chama preview externo para cada manga sem capa no boot (`apps/api/src/store/product-state-service.ts:217`).
- Busca profunda faz ate 5 paginas por provider (`apps/api/src/services/providers.ts:43`, `apps/api/src/services/providers.ts:89`).
- Downloads baixam todas as paginas de um capitulo via `Promise.all` com semaforo global, mas sem limite por job/provider alem de 3 requisicoes CDN (`apps/api/src/services/download-worker.ts:114`).
- Frontend faz polling de downloads a cada 1500 ms enquanto ha jobs ativos (`apps/client/src/context/DownloadsContext.jsx:59`).
- Reader carrega imagens em lotes de 20 e usa scroll handler com RAF; razoavel, mas atualmente as imagens sao SVG placeholders gerados pelo backend.

### Otimizacoes recomendadas

- Substituir arquivo JSON por Postgres e queries paginadas.
- Cachear resultado de search/preview por provider com TTL curto.
- Aplicar timeout e abort em todos os fetches externos.
- Mover progresso de downloads para SSE/WebSocket ou polling adaptativo.
- Fazer backfill por job assíncrono, nao no boot.

## 9. Testes Necessarios

### Unitarios

- Ranking/dedupe de busca com acentos, titulos exatos e resultados multi-provider.
- Normalizacao de legado em `AppStateRepository`.
- Validacao de contratos por dominio.
- `DownloadWorker` para Verdinha, MangaDex sem extractor e falhas de pagina.
- `runtime.js` para desktop, Android e override.

### Integracao

- Rotas Fastify com `buildServer()`: settings, auth, library delete, downloads create/cancel, preview error.
- Persistencia com Postgres quando migrar.
- Scraper Python retornando payload real e validado contra contratos Node.
- Teste de API error shape em todas as rotas.

### End-to-end

- Busca "o jogador" com `deep=true`, preview e download.
- Excluir obra legada e confirmar que ela nao ressuscita apos restart.
- Obra Verdinha com capa ausente e backfill controlado.
- Reader abrindo paginas reais apos download.
- Settings de Telegram sem expor token.

### Seguranca

- Rotas mutantes exigem auth.
- CORS rejeita origem nao permitida.
- Rate limit em search/preview/download.
- Preview rejeita host nao suportado e URLs com redirect indevido.
- Logs nao vazam token/senha.

### Regressao

- Catalogo de providers: contrato, API e UI sempre consistentes.
- Build Android/Web contra `4540`.
- Sem referencias a `4537`, Cargo ou backend Rust em caminhos operacionais.

## 10. Plano de Correcao

### Fase 1 — Correcoes urgentes

- Corrigir typecheck da API em `download-worker.ts`.
- Corrigir lint do client ou ajustar regra apenas com justificativa tecnica.
- Bloquear rotas sensiveis com auth minima.
- Remover/mascarar retorno de segredos em `/api/settings`.
- Remover scratch files da raiz e estado rastreado do Ralph loop.
- Fazer downloads de provider sem extractor retornarem erro claro.

### Fase 2 — Estabilizacao

- Padronizar erro publico em todas as rotas.
- Introduzir HTTP client central com timeout, abort e logs sanitizados.
- Separar provider catalog em `enabled` vs `known`.
- Criar testes de rotas mutantes e persistencia.
- Mover backfill de capas para job explicito.

### Fase 3 — Refatoracao

- Quebrar `AppStateRepository` por dominio.
- Migrar persistencia para Postgres e jobs para Redis.
- Implementar `services/scraper` real e mover provider scraping para la.
- Refatorar client em features e estados de erro padronizados.
- Separar `packages/contracts` por dominio.

### Fase 4 — Escala e producao

- Implementar Telegram media store real.
- Adicionar CI completo: typecheck, lint, tests, build, audit, e2e.
- Endurecer Android/Web com HTTPS e config por ambiente.
- Adicionar observabilidade e metricas por rota/provider/job.
- Rodar validacao e2e em web e Android antes de declarar cutover.

## 11. Checklist Final

- [ ] API passa `tsc --noEmit`.
- [ ] Client passa lint.
- [ ] Rotas mutantes exigem autenticacao/autorizacao.
- [ ] CORS nao usa `origin: true` em producao.
- [ ] Android nao usa `cleartext: true` fora de debug.
- [ ] Telegram token/senhas nao ficam em texto claro.
- [ ] `/api/settings` nao retorna token completo.
- [ ] Persistencia principal sai de `apps/api/data/app-state.json`.
- [ ] `library/index.json.bak` deixa de re-seedar estado automaticamente.
- [ ] Downloads nao gravam paginas finais em `library/`.
- [ ] Telegram e real ou a UI para de prometer Telegram-first.
- [ ] MangaDex e providers sem extractor falham explicitamente em download.
- [ ] `services/scraper` implementa scraping real.
- [ ] Catalogo de providers do contrato bate com adapters habilitados.
- [ ] Erros publicos seguem sempre `code/message/details`.
- [ ] Search/preview/download tem timeout, abort, rate limit e cache onde aplicavel.
- [ ] Backfill de capas nao roda bloqueando boot.
- [ ] Estados de erro do frontend deixam de virar lista vazia silenciosa.
- [ ] `frontend/` gerado e removido da raiz.
- [ ] `test-api.js`, `test-ddg.js`, `test-parse.js` saem da raiz ou viram testes/tools formais.
- [ ] `tools/ralph-loop/state/current-run.json` e `iteration-prompt.md` deixam de ser rastreados.
- [ ] Docs antigas de Rust/Cargo sao movidas para arquivo historico ou removidas do fluxo operacional.
- [ ] Existe CI cobrindo API, client, scraper e tooling.

## Validacao Executada

- [CONFIRMADO] `node --import tsx --test apps/api/test/providers.test.ts`: 8 testes passaram.
- [CONFIRMADO] `node --test tools/ralph-loop/tests/*.test.mjs`: 14 testes passaram.
- [CONFIRMADO] `npm --workspace @capdown/client run build`: passou.
- [CONFIRMADO] `python -m compileall services/scraper/app`: passou.
- [CONFIRMADO] `npm run check:v2:scraper`: passou.
- [CONFIRMADO] `npm audit --omit=dev --json`: 0 vulnerabilidades em dependencias de producao reportadas.
- [CONFIRMADO] `npm --workspace @capdown/api exec tsc -- --noEmit`: falhou em `apps/api/src/services/download-worker.ts`.
- [CONFIRMADO] `npm --workspace @capdown/client run lint`: falhou com 6 erros e 1 warning.
- [NAO CONFIRMADO] Android em emulator/dispositivo nao foi executado nesta auditoria.
- [NAO CONFIRMADO] Stack completa com Postgres/Redis/Scraper/API/Client nao foi inicializada ponta a ponta nesta auditoria.
