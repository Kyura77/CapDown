# Telegram-First Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o fluxo principal de download do CapDown “Telegram-first”, sem fallback silencioso para CBZ quando o modo estiver ativo.

**Architecture:** Introduzir um flag persistente `telegram_only_mode` em settings e propagar esse contrato para pipeline de download no backend. Quando ativo, o backend exige credenciais do Telegram, falha em upload de página interrompe o capítulo, e o frontend expõe o toggle de forma explícita.

**Tech Stack:** Rust (Axum + sqlx + tokio), React (Vite), SQLite.

---

### Task 1: Persistir `telegram_only_mode` em settings

**Files:**
- Modify: `backend/src/models.rs`
- Modify: `backend/src/db.rs`

- [ ] **Step 1: adicionar campo no modelo**
  - Incluir `telegram_only_mode: bool` em `AppSettings`.

- [ ] **Step 2: carregar do banco**
  - Em `get_settings`, mapear a chave `telegram_only_mode`.

- [ ] **Step 3: salvar no banco**
  - Em `save_settings`, persistir `telegram_only_mode`.

- [ ] **Step 4: validação**
  - Rodar `cargo test -- --skip debug_verdinha_capitulo_365166`.

### Task 2: Enforce do modo Telegram-first no pipeline

**Files:**
- Modify: `backend/src/main.rs`
- Modify: `backend/src/library.rs`

- [ ] **Step 1: exigir token/chat no job quando telegram-only**
  - Em `run_download_job`, quando `telegram_only_mode=true`, retornar erro se token/chat ausentes.

- [ ] **Step 2: propagar flag para downloader**
  - Adicionar parâmetro `telegram_only_mode` em `download_chapter` e `download_chapter_inner`.

- [ ] **Step 3: falhar sem fallback em upload de página**
  - Se upload Telegram falhar e `telegram_only_mode=true`, abortar capítulo com erro.

- [ ] **Step 4: validação**
  - Rodar `cargo test -- --skip debug_verdinha_capitulo_365166`.

### Task 3: Expor controle no frontend

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx`

- [ ] **Step 1: hidratar flag**
  - Ler `telegram_only_mode` de `/api/settings`.

- [ ] **Step 2: salvar flag**
  - Enviar `telegram_only_mode` em `saveSettings` (salvar geral e Telegram).

- [ ] **Step 3: UI explícita**
  - Adicionar toggle “Modo Telegram-first (sem fallback local)”.

- [ ] **Step 4: validação frontend**
  - Rodar `npm run lint` e `npm run build`.

### Task 4: Verificação final integrada

**Files:**
- Modify: nenhum (verificação)

- [ ] **Step 1: regressão backend**
  - Rodar `cargo test -- --skip debug_verdinha_capitulo_365166`.

- [ ] **Step 2: regressão frontend**
  - Rodar `npm run lint` e `npm run build`.

- [ ] **Step 3: check manual de contrato**
  - Confirmar que com `telegram_only_mode=true`:
    - sem token/chat -> download falha com erro explícito;
    - falha de upload -> capítulo falha (sem CBZ local).
