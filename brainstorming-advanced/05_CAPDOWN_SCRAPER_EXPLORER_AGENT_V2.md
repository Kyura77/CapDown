# 05 — CAPDOWN: Scraper Explorer Agent V2

## Crítica ao Plano Atual

O brainstorm atual (`2026-04-27-scraper-explorer-agent-brainstorm.md`) é tecnicamente empolgante mas operacionalmente irresponsável em 3 pontos:

### Problema 1 — Contornar proteções é risco legal explícito
O plano menciona:
- `undetected-playwright` para bypass de Cloudflare
- Injeção de script para "roubar" dados descriptografados da memória
- Desofuscação de AES via AST

Isso não é "exploração automática" — é **circumvention técnica**. Pode violar DMCA §1201 (EUA), similar no Brasil. Qualquer distribuição do CapDown com essas features é exposição legal.

**Decisão**: Remover completamente as seções 3, 7, 8 do brainstorm atual. O agente deve funcionar apenas com HTTP público e HTML rendering normal.

### Problema 2 — "A IA cospe um adapter_draft.py" não é arquitetura
Sem:
- Contrato de output validado
- Sandbox de execução
- Testes automáticos do adapter gerado
- Rollback se o adapter falhar

...o "auto-repair" é só um gerador de código não testado que pode travar o sistema.

### Problema 3 — Nenhuma lógica de confiança por seletor
O plano não diferencia entre um seletor que funcionou uma vez e um que funciona em 99% dos casos. Sem scoring de confiança, o sistema vai adotar seletores frágeis como se fossem confiáveis.

---

## Nova Arquitetura do Agente

### Princípios
1. **Funciona apenas com HTTP público** — sem bypass, sem injeção, sem AST hacking
2. **Outputs validados por contrato** — adapter gerado só entra em uso após passar nos testes
3. **Sandbox isolado** — código gerado nunca executa na mesma instância da API
4. **Confiança por evidência** — seletor tem score baseado em quantas vezes funcionou

### Componentes

```
┌─────────────────────────────────────────────────────────────┐
│  ExplorerAgent                                              │
│                                                             │
│  1. SiteAnalyzer    — analisa HTML/JS público do site      │
│  2. LLMAdapter      — gera código de adapter via LLM       │
│  3. AdapterSandbox  — executa adapter em processo isolado  │
│  4. ContractValidator — valida output contra schema        │
│  5. ConfidenceTracker — registra score por seletor         │
│  6. AdapterRegistry  — armazena adapters aprovados         │
└─────────────────────────────────────────────────────────────┘
```

---

## Contrato de Scraper

Todo provider deve implementar este contrato:

```python
# providers/base.py
from abc import ABC, abstractmethod
from schemas import SearchRequest, UnifiedSearchResult, PreviewResponse, PageResult

class BaseProvider(ABC):
    PROVIDER_ID: str
    BASE_URL: str
    REFERER: str
    
    @abstractmethod
    async def search(self, req: SearchRequest) -> list[UnifiedSearchResult]:
        """Retorna lista de obras. NUNCA lança exceção — retorna [] em caso de erro."""
        ...
    
    @abstractmethod
    async def get_preview(self, source_url: str) -> PreviewResponse:
        """Retorna metadata e lista de capítulos."""
        ...
    
    @abstractmethod  
    async def get_pages(self, chapter_url: str) -> list[PageResult]:
        """Retorna URLs de páginas. Cada PageResult inclui referer e headers."""
        ...
    
    def health_check(self) -> bool:
        """Retorna True se provider está acessível. Implementação padrão faz HEAD no BASE_URL."""
        ...
```

---

## Validação de Seletores

O agente NÃO confia cegamente em seletores gerados pelo LLM. Cada seletor passa por validação:

```python
class SelectorValidator:
    def validate(self, html: str, selector: str, expected_type: str) -> SelectorValidation:
        """
        expected_type: 'text' | 'url' | 'image_url' | 'number' | 'list'
        """
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        elements = soup.select(selector)
        
        if not elements:
            return SelectorValidation(valid=False, reason="selector_not_found", confidence=0.0)
        
        texts = [e.get_text(strip=True) or e.get('src') or e.get('href') for e in elements]
        texts = [t for t in texts if t]
        
        if not texts:
            return SelectorValidation(valid=False, reason="empty_results", confidence=0.0)
        
        confidence = self._score_by_type(texts, expected_type)
        return SelectorValidation(valid=confidence > 0.5, confidence=confidence, sample=texts[:3])
    
    def _score_by_type(self, values: list[str], expected_type: str) -> float:
        if expected_type == 'url':
            valid = sum(1 for v in values if v.startswith('http') or v.startswith('/'))
            return valid / len(values)
        if expected_type == 'number':
            valid = sum(1 for v in values if v.replace('.', '').isdigit())
            return valid / len(values)
        return 0.8  # text: assume válido se tem conteúdo
```

---

## Detecção de Mudança de Layout

```python
class LayoutMonitor:
    def compute_structure_hash(self, html: str) -> str:
        """Hash da estrutura do HTML, ignorando conteúdo dinâmico."""
        from bs4 import BeautifulSoup
        import hashlib
        soup = BeautifulSoup(html, 'html.parser')
        # Extrair apenas estrutura: tags + classes, sem texto ou IDs únicos
        structure = []
        for tag in soup.find_all(True):
            classes = sorted(tag.get('class', []))
            structure.append(f"{tag.name}:{':'.join(classes)}")
        return hashlib.sha256('\n'.join(structure[:200]).encode()).hexdigest()[:16]
    
    def has_layout_changed(self, provider_id: str, new_hash: str) -> bool:
        stored = self.health_repo.get_layout_hash(provider_id)
        if not stored:
            return False  # Primeira vez — não considera mudança
        return stored != new_hash
```

---

## Sandbox de Execução

```python
# adapter_sandbox.py
import subprocess
import json
import tempfile
import os

class AdapterSandbox:
    def test_adapter(self, adapter_code: str, test_url: str) -> SandboxResult:
        """
        Executa o adapter em subprocess isolado.
        NÃO executa na instância principal.
        """
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(adapter_code)
            f.write(f"\nimport asyncio, json\n")
            f.write(f"result = asyncio.run(get_pages('{test_url}'))\n")
            f.write(f"print(json.dumps([r.dict() for r in result]))\n")
            tmp_path = f.name
        
        try:
            proc = subprocess.run(
                ['python', tmp_path],
                capture_output=True, text=True, timeout=30,
                # Sem acesso à rede exceto domínio alvo (ideal: usar network namespace no Linux)
            )
            if proc.returncode != 0:
                return SandboxResult(success=False, error=proc.stderr[:500])
            
            output = json.loads(proc.stdout)
            return SandboxResult(success=True, pages=output)
        except subprocess.TimeoutExpired:
            return SandboxResult(success=False, error="timeout")
        finally:
            os.unlink(tmp_path)
```

---

## Scoring de Confiança

```python
class ConfidenceTracker:
    """Rastreia score de confiança por provider + seletor."""
    
    def record_success(self, provider_id: str, selector_id: str):
        self.db.execute("""
            INSERT INTO selector_confidence (provider_id, selector_id, successes, failures)
            VALUES (?, ?, 1, 0)
            ON CONFLICT DO UPDATE SET successes = successes + 1, updated_at = NOW()
        """, [provider_id, selector_id])
    
    def record_failure(self, provider_id: str, selector_id: str):
        self.db.execute("""
            INSERT INTO selector_confidence (provider_id, selector_id, successes, failures)
            VALUES (?, ?, 0, 1)
            ON CONFLICT DO UPDATE SET failures = failures + 1, updated_at = NOW()
        """, [provider_id, selector_id])
    
    def get_confidence(self, provider_id: str, selector_id: str) -> float:
        row = self.db.fetchone("SELECT successes, failures FROM selector_confidence WHERE ...", ...)
        if not row or (row.successes + row.failures) < 5:
            return 0.5  # inconclusivo
        return row.successes / (row.successes + row.failures)
```

---

## Plano de Implementação por Fases

### Fase 1 — Base (2 semanas)
1. Implementar `BaseProvider` ABC em `providers/base.py`
2. Refatorar `verdinha.py`, `egotoons.py`, `madara.py` para implementar `BaseProvider`
3. Implementar `SelectorValidator`
4. Implementar `LayoutMonitor` + integrar com `SourceHealth`

### Fase 2 — Sandbox (2 semanas)
1. Implementar `AdapterSandbox`
2. Implementar `ContractValidator` (valida output contra `UnifiedSearchResult` schema)
3. Tabela `selector_confidence` no schema
4. Implementar `ConfidenceTracker`

### Fase 3 — LLM Integration (3 semanas)
1. Implementar `LLMAdapter` com prompt estruturado
2. Prompt deve incluir: HTML sample, expected output schema, exemplos de adapters existentes
3. Output do LLM passa por: `SelectorValidator` → `AdapterSandbox` → `ContractValidator`
4. Apenas adapters com `confidence > 0.8` após 10 testes entram em produção

### Fase 4 — Auto-Repair (1 semana)
1. BullMQ job `check-adapter-health` roda diariamente
2. Se provider tem taxa de erro > 30%: aciona `LLMAdapter` para regenerar
3. Novo adapter entra em stage, não em produção
4. Alerta no Telegram: "Provider X gerou novo adapter. Teste em stage."
5. Aprovação manual ou automática (se 5 downloads consecutivos OK)

---

## O que NÃO implementar

- Bypass de Cloudflare/DDoS-Guard
- Injeção de script para descriptografar memória
- Download de arquivos `.js` para análise AST de chaves AES
- Computer Use / clique automático em players de vídeo
- Qualquer coisa que simulate interação humana para contornar proteção

Esses pontos ficam fora do escopo. Se um site precisar de bypass para funcionar, a decisão correta é **não suportar esse site**.
