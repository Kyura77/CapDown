# CapDown Total Replacement Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining legacy CapDown runtime with the v2 cloud-first architecture while preserving working user flows and eliminating duplicated contracts between Rust, React legacy, Node API, and Python scraper.

**Architecture:** Treat the current repository as a migration workspace with three active systems: legacy Rust backend, legacy React frontend, and v2 Node/Python bootstrap. Migrate by creating a single v2 product contract first, then move one user-facing flow at a time (health/config, library, reader, search/scrape, downloads/jobs, Telegram) until the legacy runtime can be retired.

**Tech Stack:** React/Vite, Rust/Axum/SQLite, Node/Fastify/TypeScript, Python/FastAPI, Ralph loop harness

---

## File Map

### Existing systems

- `C:\Users\cd250\Downloads\Projetos\CapDown\frontend\src\*` - legacy React product UI
- `C:\Users\cd250\Downloads\Projetos\CapDown\backend\src\*` - legacy Rust runtime and API
- `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\*` - v2 Node API bootstrap
- `C:\Users\cd250\Downloads\Projetos\CapDown\services\scraper\app\*` - v2 Python scraper bootstrap

### New files to add during migration

- `C:\Users\cd250\Downloads\Projetos\CapDown\packages\contracts\package.json` - shared v2 contract package
- `C:\Users\cd250\Downloads\Projetos\CapDown\packages\contracts\tsconfig.json` - shared package TS config
- `C:\Users\cd250\Downloads\Projetos\CapDown\packages\contracts\src\index.ts` - shared API payloads and zod schemas
- `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\routes\settings.ts` - v2 settings route
- `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\routes\library.ts` - v2 library route shell
- `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\routes\reader.ts` - v2 reader route shell
- `C:\Users\cd250\Downloads\Projetos\CapDown\frontend\src\api\v2-client.js` - frontend adapter for v2 API
- `C:\Users\cd250\Downloads\Projetos\CapDown\docs\superpowers\specs\2026-04-25-capdown-v2-product-contract.md` - single source of truth for migration contract

### Existing files likely to change during phase 1

- `C:\Users\cd250\Downloads\Projetos\CapDown\package.json` - workspace and scripts
- `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\package.json` - consume shared contracts
- `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\server.ts` - register new v2 routes
- `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\routes\scrape.ts` - move request/response schema to shared contracts
- `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\clients\scraper.ts` - consume shared contracts
- `C:\Users\cd250\Downloads\Projetos\CapDown\frontend\src\api\client.js` - prepare legacy client split without breaking current UI

---

### Task 1: Establish the single v2 product contract

**Files:**
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\docs\superpowers\specs\2026-04-25-capdown-v2-product-contract.md`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\packages\contracts\package.json`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\packages\contracts\tsconfig.json`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\packages\contracts\src\index.ts`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\package.json`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\package.json`

- [ ] **Step 1: Write the contract spec**
- [ ] **Step 2: Add the shared workspace package**
- [ ] **Step 3: Define shared zod schemas and exported TS types**
- [ ] **Step 4: Wire the workspace root and API app to consume the package**
- [ ] **Step 5: Verify TypeScript package resolution works**

### Task 2: Move the v2 API bootstrap onto the shared contract

**Files:**
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\clients\scraper.ts`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\routes\scrape.ts`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\server.ts`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\routes\settings.ts`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\routes\library.ts`
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\routes\reader.ts`

- [ ] **Step 1: Replace local scrape schemas with shared contracts**
- [ ] **Step 2: Add placeholder-but-valid v2 settings route**
- [ ] **Step 3: Add placeholder-but-valid v2 library route**
- [ ] **Step 4: Add placeholder-but-valid v2 reader route**
- [ ] **Step 5: Register all routes in the server**
- [ ] **Step 6: Verify the API boots and every route returns a valid contract**

### Task 3: Split frontend API access by backend generation

**Files:**
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\frontend\src\api\v2-client.js`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\frontend\src\api\client.js`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\frontend\src\pages\SettingsPage.jsx`

- [ ] **Step 1: Add a v2 client file with explicit v2 base URL resolution**
- [ ] **Step 2: Leave the legacy client intact but isolate its responsibility**
- [ ] **Step 3: Expose v2 endpoint selection in settings without breaking current flows**
- [ ] **Step 4: Verify the legacy frontend still builds**

### Task 4: Replace one real user flow end-to-end

**Files:**
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\routes\scrape.ts`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\services\scraper\app\main.py`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\services\scraper\app\schemas.py`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\frontend\src\pages\Dashboard.jsx`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\frontend\src\api\v2-client.js`

- [ ] **Step 1: Choose the first real flow to replace (search/scrape)**
- [ ] **Step 2: Implement a real contract instead of `accepted` stub**
- [ ] **Step 3: Point one frontend path to the v2 API behind an explicit toggle**
- [ ] **Step 4: Validate both success and error states**

### Task 5: Retire legacy paths by evidence

**Files:**
- Modify: legacy files only after parity is proven

- [ ] **Step 1: Prove the replaced flow no longer needs the Rust route**
- [ ] **Step 2: Remove dead frontend branches or legacy calls for that flow**
- [ ] **Step 3: Remove dead backend route/module only after caller removal is verified**
- [ ] **Step 4: Run regression checks again**

---

## Final Validation Checklist

- [ ] There is a single documented v2 product contract
- [ ] Shared contracts are consumed by the Node API
- [ ] The frontend can target legacy or v2 explicitly
- [ ] At least one real user flow has moved to v2
- [ ] Removed legacy code is justified by caller trace evidence
- [ ] Build/test baselines are rerun after each migration slice
