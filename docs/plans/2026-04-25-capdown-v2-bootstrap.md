# CapDown V2 Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the new CapDown V2 architecture in-repo with a Node/TypeScript API service and a Python scraper service, without breaking the current legacy app.

**Architecture:** Keep the old Rust/React stack running while introducing new service boundaries under `apps/api` and `services/scraper`. Phase 1 only scaffolds the new runtime, health endpoints, and the API-to-scraper contract.

**Tech Stack:** Fastify, TypeScript, FastAPI, Python, npm root scripts

---

## Files

### New

- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/src/index.ts`
- `apps/api/src/server.ts`
- `apps/api/src/config.ts`
- `apps/api/src/routes/health.ts`
- `apps/api/src/routes/scrape.ts`
- `apps/api/src/clients/scraper.ts`
- `services/scraper/pyproject.toml`
- `services/scraper/app/main.py`
- `services/scraper/app/schemas.py`

### Modified

- `package.json`

## Tasks

1. scaffold `apps/api` with Fastify and a minimal scrape client
2. scaffold `services/scraper` with FastAPI contracts
3. add root scripts for the v2 services
4. validate API startup and Python syntax
5. keep the legacy stack untouched

