# CapDown V2 Cloud Architecture

**Date:** 2026-04-25  
**Status:** Proposed and bootstrapped in-repo

---

## 1. Goal

Move CapDown away from a local-first Rust runtime into a cloud-first architecture with:

- Node/TypeScript as the main application backend
- Python as the scraping/extraction service
- Telegram as media storage
- the existing Rust backend kept temporarily as legacy during migration

## 2. Why this architecture

The current Rust backend is carrying too many changing concerns in one runtime:

- provider scraping
- auth/session handling
- job orchestration
- Telegram upload/storage behavior
- local library indexing
- frontend API

That design works, but it is expensive to iterate on. The main product pressure is no longer raw local performance. It is:

- faster feature work
- easier auth/scraping changes
- cleaner service boundaries
- easier maintenance

## 3. Target service split

### 3.1 API service (`apps/api`)

Responsibility:

- expose the main HTTP API for frontend and automation
- own application-level orchestration
- queue scraping jobs
- talk to Telegram and persistence later
- remain the single product-facing backend

Language:

- TypeScript

Framework:

- Fastify

### 3.2 Scraper service (`services/scraper`)

Responsibility:

- provider-specific scraping
- cookie/session/browser automation
- chapter/page extraction
- provider health-specific logic

Language:

- Python

Framework:

- FastAPI

### 3.3 Frontend

Responsibility:

- keep using the current React/Vite frontend for now
- migrate it later to talk to the new Node API instead of the Rust backend

## 4. Phase 1 scope

Phase 1 does **not** rewrite the product.

It only introduces the new architectural skeleton:

- Node API service with health and scraper proxy contract
- Python scraper service with health and scrape endpoint contract
- root scripts to run the new services
- docs that define the migration direction

## 5. Non-goals in this bootstrap

This phase does not yet migrate:

- Telegram upload flows
- database persistence
- auth and sessions
- frontend API bindings
- provider implementations
- queueing infrastructure

## 6. File layout

```text
apps/
  api/
    package.json
    tsconfig.json
    src/
      index.ts
      server.ts
      config.ts
      routes/
        health.ts
        scrape.ts
      clients/
        scraper.ts
services/
  scraper/
    pyproject.toml
    app/
      main.py
      schemas.py
```

## 7. Runtime contract

### API -> Scraper

`POST /scrape`

Request:

```json
{
  "provider": "verdinha",
  "url": "https://example.test/item",
  "mode": "manga"
}
```

Response:

```json
{
  "status": "accepted",
  "provider": "verdinha",
  "url": "https://example.test/item",
  "mode": "manga"
}
```

This is intentionally minimal. It is a boundary contract, not the final scraping payload.

## 8. Migration strategy

1. bootstrap the new architecture beside the legacy code
2. move health/config/contracts first
3. move one provider flow at a time behind the new scraper boundary
4. flip frontend endpoints after parity
5. retire Rust backend after feature parity is proven

