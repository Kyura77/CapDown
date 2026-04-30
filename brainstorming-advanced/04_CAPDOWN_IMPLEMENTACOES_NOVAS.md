# 04 — CAPDOWN: Implementações Novas

## Formato de cada implementação
Problema → Solução → Design → Passos → Testes → Prioridade → Pronto quando

---

## P0 — Essenciais (Sistema quebra sem isso)

---

### I01 — Provider Referer Dinâmico

**Problema**: `fetchWithRetry` usa `Referer: verdinha.wtf` para todos os providers.

**Solução**: Cada provider define seu `baseReferer` e `headers` extras no contrato Python. O scraper retorna esses headers junto com as URLs das páginas. O worker usa o Referer correto por página.

**Design**:
```python
# Em cada provider
PROVIDER_CONFIG = {
    "base_url": "https://verdinha.wtf",
    "referer": "https://verdinha.wtf/",
    "extra_headers": {"X-Requested-With": "XMLHttpRequest"}
}
```
```typescript
// PageResult deve incluir:
interface PageResult { url: string; referer: string; headers?: Record<string, string> }
```

**Passos**:
1. Adicionar `referer` e `headers` em `PageResult` no schema Python (`schemas.py`)
2. Cada provider retorna o referer correto para suas URLs
3. Atualizar `DownloadWorker.fetchWithRetry` para aceitar e usar esses headers
4. Atualizar `@capdown/contracts` para incluir `PageResult` com headers

**Testes**: Fixture de resposta de cada provider. Verificar que headers corretos chegam no fetch.
**Prioridade**: P0 | **Pronto quando**: Cada provider passa seu próprio Referer, nenhum usa o da Verdinha.

---

### I02 — Fallback de Fila em Memória (sem Redis)

**Problema**: BullMQ exige Redis. Sem Redis, downloads silenciosamente não funcionam.

**Solução**: Interface `IDownloadQueue` com duas implementações: `BullMQDownloadQueue` (com Redis) e `InMemoryDownloadQueue` (sem Redis). Na inicialização, tentar conectar Redis, fallback automático para in-memory com log de aviso.

**Design**:
```typescript
interface IDownloadQueue {
  enqueue(plan: DownloadPlan): Promise<void>;
  getStatus(jobId: string): Promise<JobStatus>;
  start(): Promise<void>;
}

class InMemoryDownloadQueue implements IDownloadQueue {
  private queue: DownloadPlan[] = [];
  // Processa sequencialmente com setImmediate
}
```

**Passos**:
1. Extrair interface `IDownloadQueue`
2. Implementar `InMemoryDownloadQueue` com processamento serial simples
3. Na startup: try Redis → fallback in-memory com `logger.warn`
4. Health check expõe qual modo está ativo

**Testes**: Teste unitário de `InMemoryDownloadQueue` com mock do worker.
**Prioridade**: P0 | **Pronto quando**: Sistema funciona sem Redis para uso local.

---

### I03 — Remoção de Dados Sensíveis do Git

**Problema**: `dev.db`, `library.db`, possivelmente `.env` no histórico git.

**Solução**:
1. Adicionar ao `.gitignore` raiz: `*.db`, `*.db-shm`, `*.db-wal`, `.env`, `library/`
2. Remover do tracking: `git rm --cached apps/api/prisma/dev.db library/library.db*`
3. Usar `bfg --delete-files '*.db'` para limpar histórico se necessário

**Passos**:
1. Revisar `.gitignore` raiz e de cada `apps/*`
2. Adicionar padrões de exclusão
3. Remover arquivos do tracking (não deletar do disco)
4. Commitar `.gitignore` atualizado

**Prioridade**: P0 | **Pronto quando**: `git status` e `git log` não mostram nenhum `.db` ou `.env`.

---

### I04 — API Key obrigatória na inicialização

**Problema**: `CAPDOWN_API_KEY` tem fallback inseguro `dev-key-123`.

**Solução**: Se não definida em produção (`NODE_ENV=production`), `process.exit(1)` com mensagem clara. Em desenvolvimento, aceitar default mas logar aviso.

**Design**:
```typescript
function loadApiKey(): string {
  const key = process.env.CAPDOWN_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: CAPDOWN_API_KEY must be set in production');
      process.exit(1);
    }
    logger.warn('CAPDOWN_API_KEY not set, using insecure default — development only');
    return 'dev-key-123';
  }
  return key;
}
```

**Prioridade**: P0 | **Pronto quando**: App não inicia em produção sem API Key real.

---

## P1 — Importantes (Sistema funciona mas com problemas sérios)

---

### I05 — Source Health System

**Problema**: Nenhum monitoramento de saúde por provider. Um provider quebrado não é detectado.

**Solução**: Tabela `SourceHealth` com estado por provider. Worker de health check rodando a cada 15 minutos via BullMQ repeatable job. Quarentena automática se taxa de erro > 50% em 1h.

**Design — Tabela**:
```prisma
model SourceHealth {
  provider_id     String   @id
  status          String   // healthy | degraded | offline | quarantined
  last_check_at   DateTime @default(now())
  last_success_at DateTime?
  last_error      String?
  error_count_1h  Int      @default(0)
  success_count_1h Int     @default(0)
  avg_response_ms Int?
  quarantined_until DateTime?
  layout_hash     String?  // hash do HTML de estrutura para detectar mudanças
  updated_at      DateTime @updatedAt
}
```

**Design — Job**:
```typescript
// jobs/health-check-cron.ts
async function checkProviderHealth(providerId: string): Promise<void> {
  const start = Date.now();
  try {
    const result = await scraperClient.search({ q: 'test', providers: [providerId], limit: 1 });
    await healthRepo.recordSuccess(providerId, Date.now() - start);
  } catch (err) {
    await healthRepo.recordError(providerId, err.message);
    if (await healthRepo.getErrorRate1h(providerId) > 0.5) {
      await healthRepo.quarantine(providerId, 60); // 60 minutos
    }
  }
}
```

**Passos**:
1. Adicionar `SourceHealth` ao schema Prisma e gerar migration
2. Implementar `HealthRepository`
3. Implementar `health-check-cron.ts` como BullMQ repeatable job
4. Expor `GET /api/sources/health` retornando estado de todos os providers
5. Health check principal inclui estado dos providers

**Testes**: Mock do scraper retornando erro, verificar que provider é quarentenado após limiar.
**Prioridade**: P1 | **Pronto quando**: `/api/sources/health` retorna estado real, providers quebrados são quarentenados automaticamente.

---

### I06 — Contract Tests por Provider

**Problema**: Zero testes. Um provider pode mudar silenciosamente.

**Solução**: Fixtures HTML por provider + testes que validam schema de output. Rodam offline com HTML gravado.

**Design**:
```
apps/scraper/tests/
  fixtures/
    verdinha_search_response.json
    verdinha_chapter_pages.json
    egotoons_search_response.json
  test_verdinha.py
  test_egotoons.py
  test_madara.py
```

```python
# test_verdinha.py
async def test_search_returns_valid_schema():
    with open("fixtures/verdinha_search_response.json") as f:
        mock_data = json.load(f)
    with patch("httpx.AsyncClient.get", return_value=MockResponse(mock_data)):
        results = await verdinha.search(SearchRequest(q="berserk", limit=5))
    assert len(results) > 0
    for r in results:
        assert r.title  # não vazio
        assert r.sources[0].provider_id == "verdinha"
        assert r.score >= 0.0
```

**Passos**:
1. Criar fixtures gravando resposta real de cada provider (uma vez, manualmente)
2. Escrever testes usando `pytest` + `pytest-asyncio`
3. Adicionar ao `.github/workflows/verify.yml`
4. Cada novo provider obrigatoriamente vem com fixtures + testes

**Prioridade**: P1 | **Pronto quando**: `pytest apps/scraper/tests/` passa com 0 falhas.

---

### I07 — Retry-After do Telegram

**Problema**: Rate limit 429 do Telegram não é respeitado.

**Solução**: Wrapper em `telegram-bot.ts` que parse header `Retry-After` e aguarda antes de retentar.

**Design**:
```typescript
async function telegramFetch(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const resp = await fetch(url, options);
    if (resp.status === 429) {
      const waitSec = parseInt(resp.headers.get('Retry-After') ?? '5', 10);
      logger.warn({ waitSec, attempt: i }, 'Telegram rate limit — waiting');
      await sleep(waitSec * 1000);
      continue;
    }
    return resp;
  }
  throw new Error('Telegram rate limit exceeded after retries');
}
```

**Prioridade**: P1 | **Pronto quando**: Logs mostram espera de `Retry-After` sem erros 429 em cadeia.

---

### I08 — Cache de URL do Telegram com Proxy Local

**Problema**: URLs do Telegram expiram em ~1h, quebrando imagens no Reader.

**Solução**: Endpoint proxy em `/api/library/page/:pageId` que: (1) verifica cache de URL válida, (2) se expirada/ausente, chama `getFile()` e atualiza cache, (3) redireciona para URL fresca.

**Design**:
```typescript
// routes/library.ts
GET /api/library/page/:pageId
  → cache: Map<pageId, {url: string, expiresAt: number}>
  → if cache miss ou expirado: getFile(file_id) → nova URL
  → salvar URL com expiresAt = now + 50min (margem de segurança)
  → 302 redirect para URL Telegram
```

**Tabela opcional** (para persistência entre restarts):
```prisma
model UrlCache {
  page_id    String   @id
  url        String
  expires_at DateTime
}
```

**Prioridade**: P1 | **Pronto quando**: Leitura pausada por 2h não quebra imagens.

---

### I09 — Score de Busca Real (Token + Jaro-Winkler)

**Problema**: Score = posição no array. Não é relevância.

**Solução**: Scoring composto em `search-ranking.ts`:
- Token overlap entre query e título (peso 0.6)
- Jaro-Winkler do título completo normalizado (peso 0.3)
- Sinal do provider (peso 0.1, ajustável por saúde do provider)

**Design**:
```typescript
function scoreResult(query: string, result: UnifiedSearchResult): number {
  const qTokens = tokenizeQuery(query);
  const tTokens = tokenizeQuery(result.title);
  const overlap = intersect(qTokens, tTokens).length / Math.max(qTokens.length, 1);
  const jw = jaroWinkler(normalizeText(query), normalizeText(result.title));
  const providerBonus = getProviderHealthScore(result.sources[0].provider_id); // 0.8-1.0
  return overlap * 0.6 + jw * 0.3 + providerBonus * 0.1;
}
```

**Prioridade**: P1 | **Pronto quando**: Busca por "Berserk" coloca "Berserk" antes de "Berserk of the Night".

---

### I10 — Deduplicação por Título Normalizado

**Problema**: Mesma obra de providers diferentes aparece duplicada.

**Solução**: Agrupamento em `search-ranking.ts` após scoring. Obras com título normalizado idêntico (ou similaridade > 0.9) são fundidas em um resultado com múltiplas `sources[]`.

**Design**:
```typescript
function deduplicateResults(results: ScoredResult[]): SearchResponse {
  const groups = new Map<string, ScoredResult[]>();
  for (const r of results) {
    const key = normalizeText(r.title);
    const existing = findSimilarGroup(groups, key, 0.9);
    if (existing) existing.push(r);
    else groups.set(key, [r]);
  }
  return Array.from(groups.values()).map(mergeGroup);
}
```

**Prioridade**: P1 | **Pronto quando**: Busca por "Berserk" retorna 1 resultado com 2+ sources, não 2 resultados separados.

---

### I11 — Rate Limiting por Domínio

**Problema**: Semáforo controla concorrência global, não por provider/domínio.

**Solução**: `DomainRateLimiter` com semáforo por domínio. Configurável por provider.

**Design**:
```typescript
class DomainRateLimiter {
  private semaphores = new Map<string, Semaphore>();
  private config: Record<string, number> = {
    'verdinha.wtf': 3,
    'egotoons.com': 2,
    'api.telegram.org': 5,
  };
  
  async acquire(url: string): Promise<() => void> {
    const domain = new URL(url).hostname;
    const limit = this.config[domain] ?? 2;
    const sem = this.semaphores.get(domain) ?? new Semaphore(limit);
    this.semaphores.set(domain, sem);
    await sem.acquire();
    return () => sem.release();
  }
}
```

**Prioridade**: P1 | **Pronto quando**: Downloads de 2 providers simultâneos não interferem entre si.

---

### I12 — Schema Migration com Prisma Migrate

**Problema**: Plano usa `db push`, sem histórico de migrations.

**Solução**: Gerar migration inicial do schema atual com `prisma migrate dev --name init`, commitar o diretório `prisma/migrations/`.

**Passos**:
1. Executar `npx prisma migrate dev --name init` para gerar estado atual
2. Commitar `apps/api/prisma/migrations/`
3. Remover `dev.db` do git
4. Toda mudança futura de schema via `prisma migrate dev --name <descricao>`
5. CI roda `prisma migrate deploy` antes de testes

**Prioridade**: P1 | **Pronto quando**: `apps/api/prisma/migrations/` existe no git, `dev.db` não existe.

---

### I13 — Job Queue Granular por Capítulo

**Problema**: `DownloadJob` monolítico. Falha num capítulo compromete tudo.

**Solução**: Implementar `ChapterDownloadJob` conforme planejado, com status individual por capítulo, retry individual, progresso granular.

**Design** (ver schema em `07_CAPDOWN_SCHEMA_E_DADOS.md`).

**Passos**:
1. Adicionar `ChapterDownloadJob` ao schema
2. Gerar migration
3. Atualizar `DownloadWorker` para criar um job por capítulo
4. Atualizar `ProductStateService.createDownload`
5. Atualizar endpoints de status para retornar status por capítulo
6. Deprecar `DownloadJob` (manter temporariamente para compatibilidade)

**Prioridade**: P1 | **Pronto quando**: Falha no capítulo 3 não cancela download do capítulo 4.

---

## P2 — Relevantes (Melhoram significativamente o produto)

---

### I14 — Admin/Debug Panel

**Problema**: Nenhuma visibilidade interna do estado do sistema.

**Solução**: Página React em `/admin` (protegida por API key) com:
- Tabela de jobs em execução, pausados, falhos
- Estado de saúde de cada provider
- Últimas 50 entradas de log
- Botão de reprocessar job falho
- Botão de quarentenar/restaurar provider

**Design**: Componente React que consome:
- `GET /api/admin/jobs` — lista jobs com status
- `GET /api/admin/sources` — saúde dos providers
- `GET /api/admin/logs` — últimas entradas de log
- `POST /api/admin/jobs/:id/retry` — reprocessar
- `POST /api/admin/sources/:id/quarantine` — quarentenar

**Prioridade**: P2 | **Pronto quando**: Operador consegue ver e agir sobre estado do sistema sem abrir terminal.

---

### I15 — Observabilidade Mínima (Structured Logs)

**Problema**: Logs inconsistentes, sem `request_id`, sem `source`, sem métricas.

**Solução**: Logger estruturado (pino já está instalado) com campos obrigatórios em operações críticas.

**Design**:
```typescript
// Campos obrigatórios em cada operação:
logger.info({
  request_id: crypto.randomUUID(),
  source: 'verdinha',
  operation: 'search',
  duration_ms: 342,
  result_count: 12,
  cache_hit: false,
  error_kind: null,
}, 'search completed');
```

**Prioridade**: P2 | **Pronto quando**: Todo log de operação crítica tem `source`, `operation`, `duration_ms`, `error_kind`.

---

### I16 — Cache por Provider/Operação

**Problema**: Mesma busca feita 5x em 30 segundos faz 5 requests ao provider.

**Solução**: Cache em memória com TTL por tipo de operação.
- `search(q)`: TTL 5 min
- `preview(url)`: TTL 30 min
- `chapters(url)`: TTL 10 min

**Design**:
```typescript
class ProviderCache {
  private cache = new Map<string, {data: unknown, expiresAt: number}>();
  get<T>(key: string): T | null { ... }
  set(key: string, data: unknown, ttlMs: number): void { ... }
  makeKey(provider: string, op: string, ...args: string[]): string {
    return `${provider}:${op}:${args.join(':')}`; 
  }
}
```

**Prioridade**: P2 | **Pronto quando**: Busca duplicada em 5 min usa cache, não faz request.

---

### I17 — Source Capability Matrix

**Problema**: Sistema não sabe o que cada provider suporta.

**Solução**: Objeto estático por provider declarando capabilities.

**Design**:
```typescript
interface SourceCapabilities {
  search: boolean;
  chapters: boolean;
  metadata: boolean;
  cover: boolean;
  pagination: boolean;
  requires_auth: boolean;
  media_types: ('manga' | 'novel' | 'anime')[];
  estimated_stability: 'high' | 'medium' | 'low';
}

const CAPABILITIES: Record<string, SourceCapabilities> = {
  verdinha: { search: true, chapters: true, metadata: true, cover: true, pagination: true, requires_auth: false, media_types: ['manga'], estimated_stability: 'high' },
  egotoons: { search: true, chapters: true, metadata: true, cover: true, pagination: true, requires_auth: false, media_types: ['manga'], estimated_stability: 'medium' },
};
```

**Prioridade**: P2 | **Pronto quando**: `GET /api/sources/capabilities` retorna capabilities de cada provider.

---

### I18 — Quarantine System

**Problema**: Dados ruins (título vazio, capa 404, encoding corrompido) entram direto na biblioteca.

**Solução**: Tabela `QuarantinedItem` + validação antes de salvar.

**Design**:
```prisma
model QuarantinedItem {
  id           String   @id @default(cuid())
  type         String   // search_result | chapter | page
  reason       String   // empty_title | invalid_cover | encoding_error | captcha_suspected
  payload_json String
  provider_id  String
  created_at   DateTime @default(now())
  reviewed_at  DateTime?
  disposition  String?  // approved | rejected
}
```

**Prioridade**: P2 | **Pronto quando**: Item com título vazio vai para quarentena, não para biblioteca.

---

### I19 — Compliance Layer Mínimo

**Problema**: Sem `robots.txt` parsing, sem `Retry-After`, sem rate limit explícito por domínio, sem user-agent identificável.

**Solução**: 
- User-Agent identificável: `CapDown/1.0 (+https://github.com/SEU_USUARIO/capdown)`
- Rate limit por domínio configurável
- `robots.txt` parser simples (apenas para `Disallow: /api/`)
- Log de todos os requests externos com domínio + status

**Prioridade**: P2 | **Pronto quando**: User-agent é identificável, rate limit por domínio está ativo.

---

## P3 — Nice to have

---

### I20 — Canonical Work Graph

**Problema**: Sem modelo canônico de obra. Mesma obra com nomes diferentes em providers distintos não é reconhecida.

**Solução**: Tabela `CanonicalWork` com títulos alternativos, autores, aliases. Evidências de match por fonte.

**Design**:
```prisma
model CanonicalWork {
  id                String   @id @default(cuid())
  primary_title     String
  alternative_titles String  // JSON array
  authors           String?  // JSON array
  year              Int?
  cover_hash        String?  // phash para comparação visual
  source_mappings   SourceMapping[]
}

model SourceMapping {
  id           String        @id @default(cuid())
  canonical_id String
  canonical    CanonicalWork @relation(fields: [canonical_id], references: [id])
  provider_id  String
  source_id    String
  confidence   Float         @default(1.0)
  evidence     String        // JSON: {title_match, author_match, year_match}
}
```

**Prioridade**: P3 | **Pronto quando**: Busca por "Berserk" retorna 1 resultado canônico com mappings de 3 providers.
