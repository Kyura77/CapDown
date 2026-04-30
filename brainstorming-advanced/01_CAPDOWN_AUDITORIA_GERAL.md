# 01 — CAPDOWN: Auditoria Geral

## Resumo Executivo

CapDown é um downloader pessoal de mangás com armazenamento "gratuito" via Telegram. A ideia central é inteligente: usar o Telegram como CDN de arquivos para evitar custo de armazenamento. A execução está em estágio MVP funcional, mas com sérias lacunas de robustez, observabilidade e compliance. O projeto está claramente em mid-migration — git status revela arquivos deletados do caminho antigo e não commitados no novo, schemas divergentes do plano documentado, e features prometidas inexistentes no código.

---

## Opinião Técnica Direta

O projeto **funciona para uso pessoal leve**, mas **não é produto**. É um protótipo bem documentado que acumulou débito técnico antes de ter base sólida. A documentação principal (`PROJETO_CAPDOWN_DOCUMENTACAO.md`) descreve código que existe. O plano Telegram (`2026-04-27-telegram-granular-plan.md`) descreve código que **não existe ainda**. O plano do agente explorador (`2026-04-27-scraper-explorer-agent-brainstorm.md`) tem seções que descrevem **contornar proteções de sites**, o que é um risco legal explícito.

A maior mentira da documentação: diz "Backend Rust/Axum". **É Node.js com Fastify.** Nenhuma linha de Rust no repositório.

---

## Nota: 4.5 / 10

| Categoria | Nota |
|-----------|------|
| Ideia central | 8/10 |
| Arquitetura real implementada | 4/10 |
| Qualidade do código | 5/10 |
| Observabilidade | 2/10 |
| Testes | 1/10 |
| Segurança/Compliance | 3/10 |
| Documentação vs Realidade | 4/10 |
| Robustez dos scrapers | 3/10 |

---

## Maiores Forças

1. **Ideia do Telegram First é genuinamente boa.** Evita custo de storage, aproveita CDN do Telegram, file_id como chave persistente é elegante.
2. **Semáforo + backoff exponencial no download worker** estão implementados corretamente — não é código naive.
3. **Contratos Zod compartilhados** entre backend e frontend via `@capdown/contracts` é boa prática que evita drift de tipos.
4. **BullMQ para fila de jobs** é escolha correta para este workload.
5. **Capacitor para Android** é pragmático — não reinventa app nativo.
6. **Prisma** simplifica schema evolution com migrations, mesmo que ainda não versionado corretamente.

---

## Maiores Fraquezas

1. **Referer hardcodado como `verdinha.wtf`** em `fetchWithRetry` — usado para TODOS os providers. Vai quebrar providers que validam Referer.
2. **Sem Redis = sistema mudo.** BullMQ requer Redis. Se Redis não estiver rodando, a fila silencia. Sem fallback, sem log de alerta explícito.
3. **DownloadJob monolítico ainda no schema real.** O plano de migração para `ChapterDownloadJob` existe no papel. No `schema.prisma` real: `DownloadJob` monolítico com `chapters_json` (JSON serializado em coluna SQLite). Isso é um anti-pattern.
4. **Score de busca é posição no array** (`1.0 - index * 0.01`). Não é relevância real. Dois resultados com títulos idênticos de providers diferentes podem ter scores totalmente diferentes.
5. **Zero testes.** Nenhum arquivo de teste encontrado no repositório além de pasta `apps/api/test` vazia.
6. **Nenhum sistema de saúde por fonte.** Se a Verdinha mudar a API, o sistema falha silenciosamente.
7. **Autenticação trivial.** `CAPDOWN_API_KEY` com fallback para `dev-key-123` hardcodado. Em produção, quem souber o default tem acesso total.
8. **Ausência total de rate limiting por domínio.** O semáforo controla concorrência geral, mas não por provider.

---

## Riscos Reais

### Risco Técnico Imediato
- Redis ausente derruba toda a fila de downloads sem aviso claro ao usuário.
- `db.db-shm` e `db.db-wal` commitados no repositório — dados de usuário no git.

### Risco de Compliance / Legal (SÉRIO)
- O plano do Scraper Explorer descreve explicitamente:
  - Uso de `undetected-playwright` para bypass de Cloudflare
  - Injeção de scripts para "roubar" dados descriptografados da memória
  - Desofuscação de AES via AST para extrair chaves
- Isso não é scraping — é **circumvention de proteções técnicas**, que pode violar DMCA (EUA), LGPD (Brasil) e termos de serviço dos sites.
- O projeto não tem `robots.txt` parser, não tem respeito a `Retry-After`, não tem `rate limit por domínio`.

### Risco de Dados
- `apps/api/.env` existente no repositório (não no .gitignore verificado).
- `library/` com banco SQLite incluindo dados reais commitado.
- `dev.db` marcado como modified no git — banco de dados de desenvolvimento no controle de versão.

---

## Partes Promissoras

- A arquitetura modular (providers isolados em Python) está no caminho certo.
- O design de `LibraryPage.telegram_file_id` como "chave primária de storage" é sólido.
- `@capdown/contracts` como pacote compartilhado é fundação correta.
- BullMQ + workers está bem estruturado, falta apenas completar.

---

## Partes Superestimadas

- **Scraper Explorer Agent**: 80% do doc é ficção científica. "A IA cospe um adapter_draft.py" não é arquitetura — é prompt engineering sem validação, sem sandbox, sem contrato. Implementar isso de forma confiável levaria meses.
- **TomatoDown / Animes**: Citado no plano Telegram como Task 16. Não existe. É um projeto diferente embutido num brainstorm.
- **Auto-Repair Loop com CI/CD**: Promete que o sistema se auto-conserta quando o scraper quebra. Isso requer testes de contrato, validação de output, rollback — zero dessas peças existem.
- **Anilist, Kids Filter, Pin no Telegram**: Features de produto sem nenhuma fundação de robustez abaixo delas.

---

## O que Falta Para Virar Produto Sério

1. **Testes de contrato por provider** — cada scraper deve ter um teste que valida o schema de retorno.
2. **Sistema de saúde por fonte** — online/degradado/quebrado, com quarentena automática.
3. **Rate limiting por domínio** — não global, por provider.
4. **Versionamento de schema** com migrations gerenciadas (não `db push`).
5. **Observabilidade mínima** — request_id, duração, erro tipado, fonte.
6. **Remoção de dados sensíveis do git** — `.env`, `dev.db`, `library.db`.
7. **Referer dinâmico por provider** — não hardcodado.
8. **Fallback sem Redis** — modo degradado com fila em memória para uso local.
9. **Auditoria do plano do agente explorador** para remover seções de bypass ilegal.
10. **Definição clara do escopo** — CapDown é leitor pessoal de mangás ou plataforma extensível? Decisão que muda tudo.
