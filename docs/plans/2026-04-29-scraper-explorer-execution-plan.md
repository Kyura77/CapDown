# Scraper Explorer Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bounded internal “Scraper Explorer” that captures site traffic, classifies useful endpoints, and generates evidence-backed adapter drafts for new or broken providers.

**Architecture:** This sub-project should be implemented as a developer toolchain, not as production request-path logic. Phase 1 records and normalizes browser traffic using Playwright; Phase 2 adds extractor heuristics for JSON, GraphQL, manifest, and chapter/image patterns; Phase 3 adds draft adapter generation and repair workflows. The system must stop at evidence generation unless a human explicitly approves applying a generated adapter.

**Tech Stack:** Node.js tooling, Playwright, Python scraper integration, JSON artifact storage, optional AST tooling for JS bundles.

---

## Scope

This plan covers the real sub-project described in `2026-04-27-scraper-explorer-agent-brainstorm.md`:

- endpoint mapper for new providers
- browser-driven capture
- artifact normalization
- adapter draft generation
- bounded repair loop support

This plan does **not** cover:

- silent auto-patching of production scrapers
- full LLM autonomy for website clicking without audit artifacts
- Cloudflare bypass arms race as a product feature
- video download productization

## Current State

### Confirmed repo facts

- `apps/scraper/main.py` exists and already exposes provider-specific scraping endpoints.
- `apps/scraper/providers/madara.py` already contains reusable HTML parsing logic for Madara-like sites.
- `apps/scraper/providers/egotoons.py` already wraps the Madara base provider.
- There is no dedicated explorer tool directory in the current repo.
- There is no persisted capture artifact format for browser/network exploration.
- There is no existing adapter-draft generator in the repo.

### Why this sub-project matters now

- provider drift is already real: the brainstorm explicitly cites EgoToons migrating away from the old assumptions
- the current scraper stack is still manual and provider-specific
- this tool can reduce reverse-engineering time, but only if it produces reproducible artifacts and does not directly mutate runtime code

## File Map

### Existing files this tool should read from

- `apps/scraper/main.py`
- `apps/scraper/schemas.py`
- `apps/scraper/providers/__init__.py`
- `apps/scraper/providers/madara.py`
- `apps/scraper/providers/verdinha.py`
- `apps/scraper/providers/egotoons.py`
- `apps/api/src/providers/verdinha.ts`
- `apps/api/src/providers/egotoons.ts`
- `apps/api/src/providers/types.ts`

### New files this plan expects

- `tools/scraper-explorer/package.json`
- `tools/scraper-explorer/README.md`
- `tools/scraper-explorer/src/cli.ts`
- `tools/scraper-explorer/src/config.ts`
- `tools/scraper-explorer/src/browser/session.ts`
- `tools/scraper-explorer/src/browser/capture.ts`
- `tools/scraper-explorer/src/filter/noise-filter.ts`
- `tools/scraper-explorer/src/analyzers/request-classifier.ts`
- `tools/scraper-explorer/src/analyzers/manifest-detector.ts`
- `tools/scraper-explorer/src/analyzers/provider-signals.ts`
- `tools/scraper-explorer/src/generators/python-adapter-draft.ts`
- `tools/scraper-explorer/src/generators/report-markdown.ts`
- `tools/scraper-explorer/src/storage/artifact-store.ts`
- `tools/scraper-explorer/test/*.test.ts`
- `docs/research/scraper-explorer/` for captured artifacts

## Design Rules

- The explorer must be offline-safe after capture: capture first, analyze from saved artifacts second.
- Generated code is always a draft, never directly applied to `apps/scraper/providers/`.
- A repair loop may produce a candidate patch artifact, but human review remains mandatory.
- Noise filtering must preserve raw originals for auditability.
- Browser automation and adapter generation belong in `tools/`, not inside `apps/scraper` or `apps/api`.

## Phases

### Phase 1: Traffic capture and artifact storage

Success condition:

- given a target URL, the tool records useful network and page-state artifacts reproducibly

### Phase 2: Classification and extraction heuristics

Success condition:

- the tool can identify likely search/detail/chapter/media endpoints from captures

### Phase 3: Draft generation and human-reviewed repair loop

Success condition:

- the tool outputs a provider report and a draft adapter skeleton without mutating runtime providers automatically

## Tasks

### Task 1: Scaffold the explorer tool as an isolated developer package

**Files:**
- Create: `tools/scraper-explorer/package.json`
- Create: `tools/scraper-explorer/README.md`
- Create: `tools/scraper-explorer/src/cli.ts`
- Create: `tools/scraper-explorer/src/config.ts`
- Test: `tools/scraper-explorer/test/config.test.ts`

- [ ] **Step 1: Write the failing config test**

Test cases:

- CLI rejects a missing target URL
- CLI resolves a default artifact directory under `docs/research/scraper-explorer/`
- CLI supports a named provider hint but does not require one

Run:

```powershell
node --test tools/scraper-explorer/test/config.test.ts
```

Expected: FAIL because the package does not exist yet.

- [ ] **Step 2: Create the isolated package**

Add:

- a minimal `package.json`
- a CLI entrypoint
- config parsing for:
  - `--url`
  - `--provider`
  - `--out-dir`
  - `--headful`

- [ ] **Step 3: Re-run the test**

Run:

```powershell
node --test tools/scraper-explorer/test/config.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tools/scraper-explorer/package.json tools/scraper-explorer/README.md tools/scraper-explorer/src/cli.ts tools/scraper-explorer/src/config.ts tools/scraper-explorer/test/config.test.ts
git commit -m "feat: scaffold scraper explorer tool"
```

### Task 2: Capture browser traffic and persist raw artifacts

**Files:**
- Create: `tools/scraper-explorer/src/browser/session.ts`
- Create: `tools/scraper-explorer/src/browser/capture.ts`
- Create: `tools/scraper-explorer/src/storage/artifact-store.ts`
- Test: `tools/scraper-explorer/test/capture.test.ts`

- [ ] **Step 1: Write failing capture tests**

Test cases:

- network events serialize to JSONL or JSON
- page HTML snapshot is persisted
- response bodies are persisted only for allowed content types

Run:

```powershell
node --test tools/scraper-explorer/test/capture.test.ts
```

Expected: FAIL because no capture pipeline exists.

- [ ] **Step 2: Implement a Playwright capture session**

Capture:

- request URL
- method
- headers
- post body when present
- response status
- response headers
- response body for JSON, GraphQL, text, manifest
- page HTML snapshot after load

Store one run under:

- `docs/research/scraper-explorer/<timestamp>-<host>/`

- [ ] **Step 3: Keep both index and raw payload files**

Persist:

- `run.json`
- `requests.jsonl`
- `responses/`
- `dom/landing.html`

- [ ] **Step 4: Re-run tests**

Run:

```powershell
node --test tools/scraper-explorer/test/capture.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/scraper-explorer/src/browser/session.ts tools/scraper-explorer/src/browser/capture.ts tools/scraper-explorer/src/storage/artifact-store.ts tools/scraper-explorer/test/capture.test.ts
git commit -m "feat: capture and persist scraper explorer artifacts"
```

### Task 3: Add noise filtering and request classification

**Files:**
- Create: `tools/scraper-explorer/src/filter/noise-filter.ts`
- Create: `tools/scraper-explorer/src/analyzers/request-classifier.ts`
- Create: `tools/scraper-explorer/src/analyzers/provider-signals.ts`
- Test: `tools/scraper-explorer/test/classifier.test.ts`

- [ ] **Step 1: Write failing classifier tests**

Test cases:

- images, css, fonts, analytics are ignored by default ranking
- JSON and GraphQL endpoints score highly
- `.m3u8`, `.mpd`, chapter image payloads, and `/_next/data/` endpoints are flagged as likely useful

Run:

```powershell
node --test tools/scraper-explorer/test/classifier.test.ts
```

Expected: FAIL because the analyzer does not exist.

- [ ] **Step 2: Implement the classifier**

Rank likely endpoint classes:

- search endpoint
- detail endpoint
- chapter endpoint
- media manifest endpoint
- auth/session endpoint

Use only deterministic heuristics in Phase 1:

- content-type
- pathname shape
- query parameter names
- response keys
- host/domain match

- [ ] **Step 3: Add provider signal helpers**

Examples:

- Next.js data routes
- WordPress/Madara selectors
- GraphQL POST bodies
- manifest URLs

- [ ] **Step 4: Re-run tests**

Run:

```powershell
node --test tools/scraper-explorer/test/classifier.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/scraper-explorer/src/filter/noise-filter.ts tools/scraper-explorer/src/analyzers/request-classifier.ts tools/scraper-explorer/src/analyzers/provider-signals.ts tools/scraper-explorer/test/classifier.test.ts
git commit -m "feat: classify useful scraper traffic"
```

### Task 4: Generate a human-readable exploration report

**Files:**
- Create: `tools/scraper-explorer/src/generators/report-markdown.ts`
- Modify: `tools/scraper-explorer/src/cli.ts`
- Test: `tools/scraper-explorer/test/report.test.ts`

- [ ] **Step 1: Write failing report tests**

Test cases:

- report includes top-ranked candidate endpoints
- report includes why each endpoint was ranked
- report references raw artifact file paths

Run:

```powershell
node --test tools/scraper-explorer/test/report.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Generate a markdown report per run**

Output file:

- `docs/research/scraper-explorer/<timestamp>-<host>/report.md`

Report sections:

- target URL
- host summary
- candidate endpoints
- likely search/detail/chapter/media routes
- cookies/auth clues
- open questions

- [ ] **Step 3: Re-run tests**

Run:

```powershell
node --test tools/scraper-explorer/test/report.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tools/scraper-explorer/src/generators/report-markdown.ts tools/scraper-explorer/src/cli.ts tools/scraper-explorer/test/report.test.ts
git commit -m "feat: emit scraper explorer markdown reports"
```

### Task 5: Generate Python adapter drafts from classified evidence

**Files:**
- Create: `tools/scraper-explorer/src/generators/python-adapter-draft.ts`
- Modify: `tools/scraper-explorer/src/cli.ts`
- Test: `tools/scraper-explorer/test/python-adapter-draft.test.ts`

- [ ] **Step 1: Write failing adapter-draft tests**

Test cases:

- generated draft contains provider id, base URL, and candidate methods
- generated draft never writes into `apps/scraper/providers/`
- generated output clearly marks unknown selectors/fields as unresolved comments

Run:

```powershell
node --test tools/scraper-explorer/test/python-adapter-draft.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Implement draft generation**

Output location:

- `docs/research/scraper-explorer/<timestamp>-<host>/adapter_draft.py`

Draft should include:

- provider id
- base URL
- candidate search route
- candidate preview/detail route
- candidate chapter/page route
- unresolved sections in comments

- [ ] **Step 3: Re-run tests**

Run:

```powershell
node --test tools/scraper-explorer/test/python-adapter-draft.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tools/scraper-explorer/src/generators/python-adapter-draft.ts tools/scraper-explorer/src/cli.ts tools/scraper-explorer/test/python-adapter-draft.test.ts
git commit -m "feat: generate adapter drafts from explorer artifacts"
```

### Task 6: Add bounded AST and JS-bundle analysis

**Files:**
- Create: `tools/scraper-explorer/src/analyzers/js-bundle-inspector.ts`
- Test: `tools/scraper-explorer/test/js-bundle-inspector.test.ts`

- [ ] **Step 1: Write failing bundle-analysis tests**

Test cases:

- identify hard-coded URL strings
- identify likely AES key material or crypto function references
- extract function names touching `crypto.subtle`, `atob`, `JSON.parse`, `m3u8`

Run:

```powershell
node --test tools/scraper-explorer/test/js-bundle-inspector.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Implement bounded static analysis**

This task is not deobfuscation magic. It should only:

- parse JS text
- collect string literals
- collect crypto-related identifiers
- emit a structured clue report

- [ ] **Step 3: Re-run tests**

Run:

```powershell
node --test tools/scraper-explorer/test/js-bundle-inspector.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tools/scraper-explorer/src/analyzers/js-bundle-inspector.ts tools/scraper-explorer/test/js-bundle-inspector.test.ts
git commit -m "feat: inspect captured js bundles for scraper clues"
```

### Task 7: Add a reviewed repair-loop entrypoint

**Files:**
- Modify: `tools/scraper-explorer/src/cli.ts`
- Create: `tools/scraper-explorer/src/workflows/repair-run.ts`
- Modify: `tools/scraper-explorer/README.md`
- Test: `tools/scraper-explorer/test/repair-run.test.ts`

- [ ] **Step 1: Write failing repair workflow tests**

Test cases:

- repair mode requires a named provider
- repair mode outputs a report and draft, not a live patch
- repair mode can compare current provider file paths against generated suggestions

Run:

```powershell
node --test tools/scraper-explorer/test/repair-run.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Implement repair mode**

Mode:

- `explorer repair --provider ego_toons --url https://...`

Outputs:

- fresh run artifacts
- report diff against current provider adapter
- suggested patch notes

Do not auto-write `apps/scraper/providers/*.py`.

- [ ] **Step 3: Re-run tests**

Run:

```powershell
node --test tools/scraper-explorer/test/repair-run.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tools/scraper-explorer/src/cli.ts tools/scraper-explorer/src/workflows/repair-run.ts tools/scraper-explorer/README.md tools/scraper-explorer/test/repair-run.test.ts
git commit -m "feat: add reviewed scraper repair workflow"
```

## Validation Matrix

- `node --test tools/scraper-explorer/test/*.test.ts`
- manual run against a stable target such as a known Madara demo or an allowed internal test target
- artifact review in `docs/research/scraper-explorer/`
- confirm generated adapter drafts never overwrite runtime providers automatically

## Residual Risks

- Cloudflare-heavy sites may require headful mode and manual checkpointing.
- Capturing bodies can collect sensitive cookies; artifact sanitization rules are mandatory before sharing.
- Deterministic heuristics will not solve all obfuscation; that is acceptable for v1.
- AST inspection can surface clues but not guarantee correct decryption logic.

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7

