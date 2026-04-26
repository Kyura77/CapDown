# Clean Code Stabilization Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir acoplamento, corrigir fluxos quebrados e eliminar os principais riscos estruturais do CapDown com validação objetiva em backend e frontend.

**Architecture:** A auditoria confirmou três problemas de maior impacto: persistência duplicável de páginas no backend, Reader carregando payload grande demais e contexto global do frontend acoplando biblioteca com downloads. Esta migração corrige primeiro o contrato de persistência, depois cria um fluxo dedicado para Reader e por fim separa o estado reativo do frontend para reduzir rerenders e lag.

**Tech Stack:** Rust, Axum, SQLx, SQLite, React, React Router, Axios, Framer Motion.

---

## File Structure

### Backend files to create
- Create: `backend/src/reader.rs`

### Backend files to modify
- Modify: `backend/src/main.rs`
- Modify: `backend/src/db.rs`
- Modify: `backend/src/models.rs`

### Frontend files to create
- Create: `frontend/src/context/DownloadsContext.jsx`

### Frontend files to modify
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/src/context/LibraryContext.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/DownloadsPage.jsx`
- Modify: `frontend/src/pages/MangaDetail.jsx`
- Modify: `frontend/src/pages/ReaderView.jsx`

---

### Task 1: Blindar a persistência de páginas contra duplicidade

**Files:**
- Modify: `backend/src/db.rs`
- Test: `backend/src/db.rs`

- [ ] **Step 1: Escrever teste cobrindo reprocessamento do mesmo capítulo**

Adicionar em `backend/src/db.rs`:

```rust
#[tokio::test]
async fn upsert_manga_replaces_existing_pages_for_same_chapter() {
    let temp = tempfile::tempdir().unwrap();
    let db = init_db(&temp.path().join("capdown.sqlite")).await.unwrap();

    let chapter_v1 = crate::models::LibraryChapter {
        id: "c1".into(),
        source_id: "c1".into(),
        title: "Capitulo 1".into(),
        number: Some("1".into()),
        source_url: "https://example.test/c1".into(),
        local_dir: std::path::PathBuf::from("TELEGRAM"),
        page_count: 2,
        pages: vec![
            crate::models::LibraryPage { index: 1, file_path: "TELEGRAM/c1/1".into(), telegram_file_id: Some("file-1".into()), telegram_message_id: Some(10) },
            crate::models::LibraryPage { index: 2, file_path: "TELEGRAM/c1/2".into(), telegram_file_id: Some("file-2".into()), telegram_message_id: Some(11) },
        ],
        downloaded_at: chrono::Utc::now(),
    };

    let chapter_v2 = crate::models::LibraryChapter {
        id: "c1".into(),
        source_id: "c1".into(),
        title: "Capitulo 1".into(),
        number: Some("1".into()),
        source_url: "https://example.test/c1".into(),
        local_dir: std::path::PathBuf::from("TELEGRAM"),
        page_count: 2,
        pages: vec![
            crate::models::LibraryPage { index: 1, file_path: "TELEGRAM/c1/1".into(), telegram_file_id: Some("file-1b".into()), telegram_message_id: Some(12) },
            crate::models::LibraryPage { index: 2, file_path: "TELEGRAM/c1/2".into(), telegram_file_id: Some("file-2b".into()), telegram_message_id: Some(13) },
        ],
        downloaded_at: chrono::Utc::now(),
    };

    let manga = crate::models::LibraryManga {
        id: "m1".into(),
        provider_id: crate::models::ProviderId::Verdinha,
        source_id: "m1".into(),
        source_url: "https://example.test/m1".into(),
        title: "Manga Um".into(),
        cover_url: None,
        local_dir: std::path::PathBuf::from("Manga Um"),
        chapters: vec![chapter_v1],
        updated_at: chrono::Utc::now(),
    };

    upsert_manga(&db, &manga).await.unwrap();

    let manga_updated = crate::models::LibraryManga { chapters: vec![chapter_v2], ..manga };
    upsert_manga(&db, &manga_updated).await.unwrap();

    let rows = sqlx::query("SELECT page_index, telegram_file_id FROM pages WHERE chapter_id = 'c1' ORDER BY page_index")
        .fetch_all(&db)
        .await
        .unwrap();

    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].get::<Option<String>, _>("telegram_file_id").as_deref(), Some("file-1b"));
    assert_eq!(rows[1].get::<Option<String>, _>("telegram_file_id").as_deref(), Some("file-2b"));
}
```

- [ ] **Step 2: Rodar o teste para confirmar a falha inicial**

Run: `cargo test upsert_manga_replaces_existing_pages_for_same_chapter -- --nocapture`
Expected: FAIL por duplicidade/estado antigo persistido.

- [ ] **Step 3: Adicionar unicidade e limpeza transacional**

Em `init_db`, criar o índice:

```rust
sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_chapter_page ON pages(chapter_id, page_index)")
    .execute(&pool)
    .await?;
```

Em `upsert_manga`, antes de reinserir páginas do capítulo:

```rust
sqlx::query("DELETE FROM pages WHERE chapter_id = ?")
    .bind(&chapter.id)
    .execute(&mut *tx)
    .await?;
```

E trocar o insert para `INSERT INTO pages ...` em vez de `INSERT OR IGNORE`.

- [ ] **Step 4: Rodar os testes do backend**

Run: `$env:CAPDOWN_VERDINHA_BEARER='test-token'; cargo test -- --skip debug_verdinha_capitulo_365166`
Expected: PASS.

### Task 2: Criar contrato dedicado para o Reader no backend

**Files:**
- Create: `backend/src/reader.rs`
- Modify: `backend/src/main.rs`
- Modify: `backend/src/db.rs`
- Modify: `backend/src/models.rs`
- Test: `backend/src/db.rs`

- [ ] **Step 1: Escrever o teste do carregamento de um único capítulo com navegação**

Adicionar em `backend/src/db.rs` um teste novo que cria dois capítulos e valida o retorno do capítulo atual com `prev/next`.

- [ ] **Step 2: Rodar o teste para confirmar a falha inicial**

Run: `cargo test load_reader_chapter_returns_only_requested_chapter_and_neighbors -- --nocapture`
Expected: FAIL com função/tipo inexistente.

- [ ] **Step 3: Adicionar os tipos do Reader em `backend/src/models.rs`**

Criar `ReaderChapterNav` e `ReaderChapterPayload`.

- [ ] **Step 4: Implementar `load_reader_chapter` em `backend/src/db.rs`**

Assinatura alvo:

```rust
pub async fn load_reader_chapter(
    pool: &Db,
    manga_id: &str,
    chapter_id: &str,
) -> anyhow::Result<Option<crate::models::ReaderChapterPayload>>
```

- [ ] **Step 5: Criar handler dedicado em `backend/src/reader.rs`**

Implementar `get_reader_chapter`.

- [ ] **Step 6: Registrar a rota em `backend/src/main.rs`**

Adicionar:

```rust
.route("/api/library/:manga_id/chapters/:chapter_id", get(reader::get_reader_chapter))
```

- [ ] **Step 7: Rodar os testes do backend**

Run: `$env:CAPDOWN_VERDINHA_BEARER='test-token'; cargo test -- --skip debug_verdinha_capitulo_365166`
Expected: PASS.

### Task 3: Separar contexto de biblioteca e downloads no frontend

**Files:**
- Create: `frontend/src/context/DownloadsContext.jsx`
- Modify: `frontend/src/context/LibraryContext.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/DownloadsPage.jsx`
- Modify: `frontend/src/pages/MangaDetail.jsx`

- [ ] **Step 1: Isolar `LibraryContext` para cuidar só da biblioteca**

Remover `downloads` e `refreshDownloads` desse provider e memoizar o `value`.

- [ ] **Step 2: Criar `DownloadsContext.jsx` com polling próprio**

Provider separado que busca/polla downloads e chama `refreshLibrary` apenas quando job completa.

- [ ] **Step 3: Encadear os providers em `frontend/src/App.jsx`**

`<LibraryProvider><DownloadsProvider><Router>...`

- [ ] **Step 4: Atualizar consumidores**

- `Dashboard.jsx`: usar `useLibrary()` e `useDownloads()`
- `DownloadsPage.jsx`: usar `useDownloads()`
- `MangaDetail.jsx`: continuar usando apenas `useLibrary()`

- [ ] **Step 5: Rodar lint**

Run: `npm run lint`
Expected: PASS.

### Task 4: Migrar o Reader para o endpoint dedicado e limpar o fluxo de paginação

**Files:**
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/src/pages/ReaderView.jsx`

- [ ] **Step 1: Adicionar método do reader no client**

Adicionar `getReaderChapter`.

- [ ] **Step 2: Trocar o fetch do Reader para o payload dedicado**

Parar de chamar `api.getManga(mangaId)` e usar `api.getReaderChapter(mangaId, chapterId)`.

- [ ] **Step 3: Simplificar navegação e páginas**

Usar `readerPayload.chapter`, `readerPayload.pages`, `readerPayload.prev_chapter` e `readerPayload.next_chapter`.

- [ ] **Step 4: Corrigir reset de visibilidade por capítulo**

Trocar `visibleByChapter` por `visibleCount` simples resetado quando `chapterId` muda.

- [ ] **Step 5: Rodar lint e build**

Run:
```powershell
npm run lint
npm run build
```

Expected: ambos PASS.

### Task 5: Limpeza de backend relacionada ao fluxo Telegram/local

**Files:**
- Modify: `backend/src/library.rs`
- Test: `backend/src/library.rs`

- [ ] **Step 1: Corrigir bug de log em `delete_from_telegram`**

Trocar `message_ids.is_empty()` por `message_ids.len()` no log.

- [ ] **Step 2: Adicionar teste do path virtual Telegram como contrato explícito**

Garantir teste que valida `TELEGRAM/chapter-id/index`.

- [ ] **Step 3: Rodar testes do backend**

Run: `$env:CAPDOWN_VERDINHA_BEARER='test-token'; cargo test -- --skip debug_verdinha_capitulo_365166`
Expected: PASS.

### Task 6: Validação final e auditoria residual

**Files:**
- Modify: nenhum

- [ ] **Step 1: Rodar baseline completo**

Run:
```powershell
cd backend
$env:CAPDOWN_VERDINHA_BEARER='test-token'
cargo test -- --skip debug_verdinha_capitulo_365166
cd ..\frontend
npm run lint
npm run build
```

Expected: tudo PASS.

- [ ] **Step 2: Verificar resíduos principais da migração**

Run:
```powershell
Get-ChildItem -Recurse backend\src,frontend\src -File | Select-String -Pattern 'getManga\(|downloads\s*=|refreshDownloads|LibraryProvider|DownloadsProvider'
```

Expected:
- Reader não depende mais de `getManga`
- Downloads não moram mais em `LibraryContext`
- `App.jsx` já monta os dois providers

- [ ] **Step 3: Registrar o impacto**

Checklist de aceitação:
- persistência de páginas não duplica mais
- Reader não baixa mais o payload completo do mangá
- polling de downloads não rerenderiza consumidores só de biblioteca
- fluxo Telegram/local continua funcional
- backend e frontend continuam buildando sem regressão

---

## Self-Review

**Spec coverage:**
- clean code com checks: coberto por tasks com teste/lint/build
- execução incremental: coberto por tasks pequenas e verificáveis
- debug/refatoração de fluxos quebrados: coberto por persistência, reader, polling/context e limpeza do fluxo Telegram

**Placeholder scan:**
- não há TODO/TBD solto

**Type consistency:**
- `ReaderChapterPayload`, `ReaderChapterNav`, `DownloadsProvider`, `useDownloads`, `load_reader_chapter` são usados com nomes consistentes
