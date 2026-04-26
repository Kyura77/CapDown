# Telegram-First Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o modo Telegram-first removendo as últimas dependências funcionais de disco e alinhando a verificação de integridade e a UI com esse contrato.

**Architecture:** O backend já suporta `telegram_only_mode`, mas ainda salva capa local e ainda interpreta integridade como "arquivo local/CBZ esperado". A finalização é fazer o modo Telegram-first ser explicitamente DB+Telegram-first: sem write local de capa e com verificação baseada em `telegram_file_id`, enquanto a UI para de comunicar "local" como caminho principal nesse modo.

**Tech Stack:** Rust (Axum, sqlx, tokio), React (Vite), SQLite.

---

### Task 1: Eliminar escrita local de capa em Telegram-only

**Files:**
- Modify: `backend/src/main.rs`

- [ ] **Step 1: localizar a escrita de capa**

Verificar o trecho atual:

```rust
if let Err(e) = library.save_cover(&state.http, &manga).await {
    tracing::warn!("Failed to save cover for {}: {}", manga.title, e);
}
```

- [ ] **Step 2: condicionar a escrita à estratégia de storage**

Trocar para:

```rust
if !telegram_only_mode {
    if let Err(e) = library.save_cover(&state.http, &manga).await {
        tracing::warn!("Failed to save cover for {}: {}", manga.title, e);
    }
}
```

- [ ] **Step 3: validar compilação**

Run:

```powershell
$env:CAPDOWN_VERDINHA_BEARER='test-token'; cargo test -- --skip debug_verdinha_capitulo_365166
```

Expected: testes passam sem regressão.

### Task 2: Mudar integridade para Telegram-first

**Files:**
- Modify: `backend/src/db.rs`
- Modify: `backend/src/main.rs`
- Test: `backend/src/db.rs`

- [ ] **Step 1: expandir assinatura de integridade**

Trocar:

```rust
pub async fn verify_integrity(
    pool: &Db,
    library_root: &std::path::Path,
) -> anyhow::Result<Vec<serde_json::Value>>
```

por:

```rust
pub async fn verify_integrity(
    pool: &Db,
    library_root: &std::path::Path,
    telegram_only_mode: bool,
) -> anyhow::Result<Vec<serde_json::Value>>
```

- [ ] **Step 2: criar branch de regra Telegram-only**

Se `telegram_only_mode == true`:
- `stored_pages == 0` continua `pages_missing`
- `telegram_pages < stored_pages` vira `telegram_missing`
- **não** verificar `cbz_missing`

Implementação alvo:

```rust
if stored_pages == 0 {
    reports.push(serde_json::json!({
        "chapter_id": row.get::<String, _>("id"),
        "chapter_title": row.get::<String, _>("title"),
        "manga_title": row.get::<String, _>("manga_title"),
        "issue": "pages_missing",
        "stored_pages": stored_pages,
        "expected_pages": page_count
    }));
    continue;
}

if telegram_only_mode {
    if telegram_pages < stored_pages {
        reports.push(serde_json::json!({
            "chapter_id": row.get::<String, _>("id"),
            "chapter_title": row.get::<String, _>("title"),
            "manga_title": row.get::<String, _>("manga_title"),
            "stored_pages": stored_pages,
            "telegram_pages": telegram_pages,
            "expected_pages": page_count,
            "issue": "telegram_missing"
        }));
    }
    continue;
}
```

- [ ] **Step 3: propagar o setting no handler**

No `verify_library` de `backend/src/main.rs`, carregar settings e chamar:

```rust
let settings = db::get_settings(&state.db).await.unwrap_or_default();
let r = db::verify_integrity(&state.db, library.root(), settings.telegram_only_mode).await?;
```

- [ ] **Step 4: adicionar teste de regressão**

Adicionar teste no módulo `tests` de `backend/src/db.rs`:

```rust
#[tokio::test]
async fn verify_integrity_reports_missing_telegram_pages_in_telegram_only_mode() {
    let temp = tempfile::tempdir().unwrap();
    let db = init_db(&temp.path().join("capdown.sqlite")).await.unwrap();
    insert_base_manga(&db).await;

    sqlx::query(
        "INSERT INTO chapters (id, manga_id, source_id, title, number, source_url, local_dir, page_count, downloaded_at)
         VALUES ('c1', 'm1', 'c1', 'Capitulo 1', '1', 'https://example.test/c1', 'TELEGRAM', 2, '2026-01-01T00:00:00Z')",
    )
    .execute(&db)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO pages (chapter_id, page_index, file_path, telegram_file_id, telegram_message_id)
         VALUES ('c1', 1, 'TELEGRAM/c1/1', 'file-id-1', 10)",
    )
    .execute(&db)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO pages (chapter_id, page_index, file_path, telegram_file_id, telegram_message_id)
         VALUES ('c1', 2, 'TELEGRAM/c1/2', NULL, NULL)",
    )
    .execute(&db)
    .await
    .unwrap();

    let reports = verify_integrity(&db, temp.path(), true).await.unwrap();
    assert_eq!(reports.len(), 1);
    assert_eq!(reports[0]["issue"], "telegram_missing");
}
```

### Task 3: Alinhar UI com Telegram-first

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx`

- [ ] **Step 1: adicionar label de issue**

Adicionar:

```javascript
telegram_missing: 'Paginas sem upload no Telegram',
```

- [ ] **Step 2: corrigir label de armazenamento**

Trocar:

```javascript
<strong>{tgAuto ? 'Telegram' : 'Local'}</strong>
```

por:

```javascript
<strong>{tgOnlyMode ? 'Telegram-first' : tgAuto ? 'Misto' : 'Local'}</strong>
```

- [ ] **Step 3: ajustar copy**

Trocar subtítulo de sistema para refletir cloud-first quando o toggle estiver ativo, sem dizer que local é obrigatório.

### Task 4: Verificação final

**Files:**
- Modify: nenhum

- [ ] **Step 1: backend**

Run:

```powershell
$env:CAPDOWN_VERDINHA_BEARER='test-token'; cargo test -- --skip debug_verdinha_capitulo_365166
```

Expected: todos os testes passam.

- [ ] **Step 2: frontend**

Run:

```powershell
npm run lint
npm run build
```

Expected: ambos passam.
