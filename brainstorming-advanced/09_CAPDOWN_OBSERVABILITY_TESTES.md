# 09 — CAPDOWN: Observabilidade e Testes

## Logs Necessários

### Campos Obrigatórios em Todo Log de Operação

```typescript
interface LogContext {
  request_id: string;    // UUID por request HTTP ou UUID por job
  operation: string;     // 'search' | 'download_page' | 'upload_telegram' | 'health_check'
  source?: string;       // provider_id quando aplicável
  duration_ms?: number;  // duração da operação
  error_kind?: string;   // tipo tipado do erro
  retry_count?: number;
  cache_hit?: boolean;
  result_count?: number; // para operações de busca
}
```

### Eventos de Log Obrigatórios

```typescript
// Início de job
logger.info({ request_id, job_id, manga_title, chapter_number, total_pages }, 'chapter_job.started');

// Upload de página
logger.debug({ request_id, job_id, page_index, file_size_bytes, duration_ms, bot_id }, 'page.uploaded');

// Falha de página (com retry)
logger.warn({ request_id, job_id, page_index, error_kind, retry_count, will_retry: true }, 'page.upload_failed');

// Falha definitiva
logger.error({ request_id, job_id, page_index, error_kind, retry_count }, 'page.upload_exhausted');

// Busca
logger.info({ request_id, source, query, result_count, duration_ms, cache_hit }, 'search.completed');

// Health check
logger.info({ source, status, avg_ms, error_rate_1h }, 'health_check.result');

// Rate limit Telegram
logger.warn({ bot_id, retry_after_ms }, 'telegram.rate_limited');

// Provider quarentenado
logger.warn({ source, error_rate_1h, quarantined_until }, 'source.quarantined');
```

---

## Métricas (Instrumentação Mínima)

Sem Prometheus obrigatório — usar contadores simples em memória expostos em `/api/metrics`:

```typescript
interface SystemMetrics {
  downloads: {
    jobs_completed_total: number;
    jobs_failed_total: number;
    pages_uploaded_total: number;
    bytes_uploaded_total: number;
    avg_duration_ms_last_100: number;
  };
  search: {
    requests_total: number;
    cache_hits_total: number;
    avg_duration_ms: number;
    by_source: Record<string, { requests: number; errors: number; avg_ms: number }>;
  };
  telegram: {
    uploads_total: number;
    rate_limits_total: number;
    errors_total: number;
  };
  system: {
    uptime_seconds: number;
    queue_mode: 'redis' | 'in_memory';
    redis_connected: boolean;
  };
}
```

---

## Testes Unitários

### Download Worker

```typescript
// apps/api/test/download-worker.test.ts
describe('DownloadWorker', () => {
  test('fetchWithRetry retries on 502 with backoff', async () => {
    let attempts = 0;
    mockFetch.mockImplementation(() => {
      attempts++;
      if (attempts < 3) return Promise.resolve({ ok: false, status: 502 });
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(Buffer.from('img')) });
    });
    const result = await fetchWithRetry('https://example.com/page.jpg');
    expect(attempts).toBe(3);
    expect(result).toBeTruthy();
  });

  test('fetchWithRetry uses provider-specific Referer', async () => {
    const page: PageResult = { url: 'https://egotoons.com/p/1.jpg', referer: 'https://egotoons.com/', index: 0 };
    await fetchWithRetry(page.url, { referer: page.referer });
    expect(mockFetch.calls[0].headers['Referer']).toBe('https://egotoons.com/');
  });

  test('semaphore limits concurrent downloads', async () => {
    // Verificar que não mais que N downloads simultâneos por domínio
  });
});
```

### Search Ranking

```typescript
describe('SearchRanking', () => {
  test('ranks exact title match higher than partial', () => {
    const results = rank('Berserk', [
      makeResult('Berserk of the Night'),
      makeResult('Berserk'),
      makeResult('Berserk: The Prototype'),
    ]);
    expect(results[0].title).toBe('Berserk');
  });

  test('deduplicates same title from two providers', () => {
    const results = deduplicate([
      makeResult('Berserk', 'verdinha'),
      makeResult('Berserk', 'egotoons'),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].sources).toHaveLength(2);
  });

  test('score is not just array position', () => {
    const r1 = scoreResult('naruto', makeResult('Naruto'));
    const r2 = scoreResult('naruto', makeResult('Naruto Gaiden'));
    expect(r1).toBeGreaterThan(r2);
  });
});
```

---

## Testes de Contrato por Provider (Python)

```python
# apps/scraper/tests/test_verdinha.py
import pytest
from unittest.mock import patch, AsyncMock
import json

FIXTURE_SEARCH = json.loads(open('fixtures/verdinha_search_response.json').read())
FIXTURE_PAGES = json.loads(open('fixtures/verdinha_pages_response.json').read())

@pytest.mark.asyncio
async def test_search_returns_valid_results():
    with patch('httpx.AsyncClient.get', return_value=MockResponse(FIXTURE_SEARCH, 200)):
        from providers.verdinha import search
        results = await search(SearchRequest(q='berserk', limit=5, page=1))
    
    assert isinstance(results, list)
    assert len(results) > 0
    for r in results:
        assert r.title and len(r.title.strip()) > 0, "title must not be empty"
        assert r.sources[0].provider_id == 'verdinha'
        assert 0.0 <= r.score <= 1.0
        assert r.sources[0].source_id  # não vazio

@pytest.mark.asyncio
async def test_search_empty_query_returns_empty():
    # Provider não deve explodir com query vazia
    results = await search(SearchRequest(q='', limit=5, page=1))
    assert isinstance(results, list)

@pytest.mark.asyncio
async def test_get_pages_returns_valid_urls():
    with patch('httpx.AsyncClient.get', return_value=MockResponse(FIXTURE_PAGES, 200)):
        from providers.verdinha import get_pages
        pages = await get_pages('https://verdinha.wtf/obras/123/capitulo/1')
    
    assert len(pages) > 0
    for p in pages:
        assert p.url.startswith('http'), f"page URL must be absolute: {p.url}"
        assert p.referer, "referer must not be empty"
        assert isinstance(p.index, int)

@pytest.mark.asyncio
async def test_provider_does_not_panic_on_503():
    with patch('httpx.AsyncClient.get', side_effect=httpx.HTTPStatusError('503', ...)):
        results = await search(SearchRequest(q='test', limit=5, page=1))
    assert results == []  # Retorna vazio, não lança exceção
```

---

## Testes de Integração

```typescript
// apps/api/test/integration/download-flow.test.ts
describe('Download Flow Integration', () => {
  test('full chapter download stores pages in DB with file_ids', async () => {
    // Setup: mock scraper returns 3 pages, mock Telegram returns file_ids
    mockScraper.getPages.mockResolvedValue([
      { url: 'http://img1.com', index: 0, referer: 'http://site.com' },
      { url: 'http://img2.com', index: 1, referer: 'http://site.com' },
      { url: 'http://img3.com', index: 2, referer: 'http://site.com' },
    ]);
    mockTelegram.sendDocument.mockResolvedValue('file_id_abc');
    
    await worker.processChapterJob(testJobId);
    
    const pages = await libraryRepo.getPages(testChapterId);
    expect(pages).toHaveLength(3);
    expect(pages.every(p => p.telegram_file_id)).toBe(true);
  });

  test('interrupted job resumes without duplicating pages', async () => {
    // Setup: job com 2 de 3 páginas já enviadas no uploaded_pages_json
    // Verificar que apenas a 3a página é enviada ao Telegram
    mockTelegram.sendDocument.mockResolvedValue('file_id_new');
    
    await worker.processChapterJob(partialJobId);
    
    expect(mockTelegram.sendDocument).toHaveBeenCalledTimes(1); // Só a 3a
  });
});
```

---

## Fixtures HTML

```
apps/scraper/tests/fixtures/
  verdinha_search_response.json     — Resposta real da API, sanitizada
  verdinha_pages_response.json      — Resposta real de páginas de capítulo
  egotoons_search_response.html     — HTML real da página de busca (para scraping)
  egotoons_chapter_page.html        — HTML real de capítulo
  madara_search_response.html       — HTML tipo Madara genérico
  madara_chapter_page.html

Gravar fixtures:
  python -c "
  import httpx, json
  r = httpx.get('https://api.verdinha.wtf/obras/buscar?q=test&limite=5')
  open('fixtures/verdinha_search_response.json', 'w').write(r.text)
  "
```

---

## Testes de Regressão de Layout

```python
# apps/scraper/tests/test_layout_regression.py

@pytest.mark.asyncio
async def test_verdinha_layout_unchanged():
    """Falha se a estrutura do HTML do site mudou desde a fixture."""
    from providers.verdinha import search
    from tools.layout_monitor import LayoutMonitor
    
    # Hash da fixture HTML gravada quando scraper funcionava
    known_hash = "a3f4b2c1"  # Atualizar ao gravar nova fixture intencionalmente
    
    current_html = open('fixtures/verdinha_homepage.html').read()
    current_hash = LayoutMonitor().compute_structure_hash(current_html)
    
    assert current_hash == known_hash, (
        f"Layout da Verdinha MUDOU. Hash anterior: {known_hash}, atual: {current_hash}. "
        f"Se mudança intencional: atualizar fixture e hash. Se não: scraper pode estar quebrado."
    )
```

---

## Estratégia de CI

```yaml
# .github/workflows/verify.yml (adições)
jobs:
  test-scraper:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.13' }
      - run: pip install -e "apps/scraper[test]"
      - run: pytest apps/scraper/tests/ -v --no-header
        env:
          CAPDOWN_TEST_MODE: "1"  # Não fazer requests reais
  
  test-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm test --workspace=apps/api
  
  check-schema:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx prisma validate
      - run: npx prisma format --check  # Falha se schema não formatado
```
