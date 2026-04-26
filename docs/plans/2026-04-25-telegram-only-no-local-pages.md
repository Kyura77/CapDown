# Telegram-Only No-Local-Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover escrita de páginas em disco e empacotamento CBZ quando `telegram_only_mode` estiver ativo.

**Architecture:** O pipeline de download já conhece `telegram_only_mode`, mas ainda escreve arquivos temporários locais antes de apagar tudo. A correção é bifurcar o fluxo do capítulo: em modo Telegram-only, cada página vira upload direto e registro virtual `TELEGRAM/<chapter>/<index>` no banco, sem `chapter_dir`, sem `pack_cbz`, sem `remove_file`.

**Tech Stack:** Rust (tokio, futures, Axum), SQLite via sqlx, React/Vite apenas para validação de compatibilidade.

---

### Task 1: Planejar o branch Telegram-only no downloader

**Files:**
- Modify: `backend/src/library.rs`

- [ ] **Step 1: mapear pontos de escrita local**

Verificar em `download_chapter` e `download_chapter_inner` onde hoje existem:
- `create_dir_all`
- `tokio::fs::write`
- `pack_cbz`
- `remove_file`
- `remove_dir`

- [ ] **Step 2: introduzir path virtual Telegram**

Adicionar helper em `backend/src/library.rs`:

```rust
fn telegram_page_virtual_path(chapter_id: &str, page_index: usize) -> PathBuf {
    PathBuf::from("TELEGRAM")
        .join(chapter_id)
        .join(page_index.to_string())
}
```

- [ ] **Step 3: validar helper com teste**

Adicionar teste:

```rust
#[test]
fn stores_telegram_pages_as_virtual_paths() {
    assert_eq!(
        telegram_page_virtual_path("m1:c1", 7),
        Path::new("TELEGRAM").join("m1:c1").join("7")
    );
}
```

### Task 2: Remover pipeline local em `telegram_only_mode`

**Files:**
- Modify: `backend/src/library.rs`

- [ ] **Step 1: não criar `chapter_dir` no modo Telegram-only**

Em `download_chapter`, trocar:

```rust
let chapter_dir = manga_dir(library.root(), manga).join(chapter_dir_name(chapter));
tokio::fs::create_dir_all(&chapter_dir).await?;
```

por fluxo condicional:

```rust
let chapter_dir = (!telegram_only_mode)
    .then(|| manga_dir(library.root(), manga).join(chapter_dir_name(chapter)));
if let Some(dir) = &chapter_dir {
    tokio::fs::create_dir_all(dir).await?;
}
```

- [ ] **Step 2: passar `Option<&Path>` para o inner**

Assinatura alvo:

```rust
async fn download_chapter_inner<F, Fut>(
    ...
    chapter_dir: Option<&std::path::Path>,
    telegram_only_mode: bool,
    ...
)
```

- [ ] **Step 3: não gravar bytes no disco no branch Telegram-only**

Dentro do map das páginas:

```rust
if telegram_only_mode {
    let (token, chat_id) = tg
        .ok_or_else(|| anyhow::anyhow!("telegram_only_mode enabled but Telegram config is missing"))?;
    let (fid, mid) = upload_to_telegram(
        &http,
        &token,
        &chat_id,
        &final_bytes,
        &format!("{:03}.{ext}", page.index),
    )
    .await?;

    on_page().await;

    return Ok::<_, anyhow::Error>(LibraryPage {
        index: page.index,
        file_path: telegram_page_virtual_path(
            &format!("{}:{}", manga.source_id, chapter.source_id),
            page.index,
        ),
        telegram_file_id: Some(fid),
        telegram_message_id: Some(mid),
    });
}
```

- [ ] **Step 4: manter branch local antigo intacto para modo misto**

Só o branch `telegram_only_mode` muda. O branch normal continua:
- escrever arquivo
- opcionalmente subir pro Telegram
- empacotar CBZ se não for cloud puro

- [ ] **Step 5: não chamar `pack_cbz`/`remove_file`/`remove_dir` no modo Telegram-only**

Condicionar pós-processamento:

```rust
if telegram_only_mode {
    return Ok(LibraryChapter {
        ...
        local_dir: PathBuf::from("TELEGRAM"),
        ...
    });
}
```

### Task 3: Verificação

**Files:**
- Modify: nenhum

- [ ] **Step 1: rodar backend**

Run:

```powershell
$env:CAPDOWN_VERDINHA_BEARER='test-token'; cargo test -- --skip debug_verdinha_capitulo_365166
```

Expected: `31 passed` ou mais, sem regressão.

- [ ] **Step 2: rodar frontend**

Run:

```powershell
npm run lint
npm run build
```

Expected: ambos `ok`, sem mudanças contratuais quebrando UI.
