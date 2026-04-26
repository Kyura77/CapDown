# CapDown V2 Product Contract

**Date:** 2026-04-25  
**Status:** Active migration contract

---

## 1. Purpose

This document defines the single product-facing contract for CapDown v2 during the total replacement migration.

It exists to stop contract drift between:

- legacy Rust backend
- legacy React frontend
- v2 Node API
- v2 Python scraper

The migration rule is simple:

1. define the contract here
2. encode it in `packages/contracts`
3. consume it from the Node API first
4. migrate frontend and scraper against the same contract
5. remove legacy callers after parity is proven

## 2. Current in-scope contract surface

### 2.1 Health

`GET /health`

```json
{
  "ok": true,
  "service": "capdown-v2-api",
  "runtime": "node"
}
```

### 2.2 Scrape orchestration

`POST /v1/scrape`

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

## 3. Design constraints

- Keep the contract minimal until a real flow is migrated.
- Avoid copying the legacy Rust payloads wholesale into v2.
- Every new v2 route must have:
  - runtime validation
  - exported TypeScript type
  - one canonical schema in `packages/contracts`

## 4. Near-term expansion order

1. scrape/search
2. settings
3. library index
4. manga detail
5. reader chapter
6. downloads/jobs
7. Telegram preparation and audit

## 5. Migration rule for legacy retirement

No legacy route or caller is removed until:

1. a v2 route exists,
2. at least one frontend path or automated caller uses it,
3. validation/build checks pass,
4. caller removal is confirmed by code search.
