# CapDown Plan

## Summary

This repository is being reorganized into a clean, cloud-first structure with explicit boundaries:
- `apps/` for product applications
- `services/` for workers and auxiliary services
- `packages/` for shared contracts and config
- `tools/` for automation
- `infra/` for runtime/bootstrap
- `docs/` for architecture, plans, migration notes, screenshots, and research
- `legacy/` for temporary holdouts only

The immediate goal is to eliminate structural ambiguity: no mixed responsibility directories, no generated artifacts treated as project structure, and no direct frontend dependence on the Rust backend.

## Key Changes

1. Normalize the repo root.
   - Keep only source, docs, infra, tooling, and explicit legacy in the root layout.
   - Treat generated artifacts as disposable and ignore them by default.
   - Keep screenshots and research artifacts under `docs/`.

2. Consolidate apps and tooling.
   - `frontend/` becomes `apps/client/`.
   - `backend/` becomes `legacy/rust-backend/` as a temporary transition step.
   - Ralph loop assets live under `tools/ralph-loop/`.

3. Standardize shared contracts.
   - Public payloads and env parsing live in `packages/contracts` and `packages/config`.
   - API responses use stable error shapes and schema validation.
   - The Node API remains the public entrypoint for the client.

4. Remove legacy by evidence.
   - Move each user-facing route family out of the proxy layer into explicit Node routes.
   - Remove Rust only after the Node/Python path is functionally complete.
   - Keep the frontend pointed only at the Node API.

## Test Plan

- `npm run ralph:test`
- `npm run dev:v2:api`
- `npm --workspace @capdown/client run build`
- `npm run check:v2:scraper`
- HTTP smoke checks against `apps/api`
- Path and import validation after each move

## Assumptions

- The migration stays aggressive and physically reorganizes directories early.
- Rust is temporary and must not remain a parallel architecture.
- `apps/api` is the only public backend once the current cleanup is complete.
- `plan.md` is the operational plan of record for the repo.
