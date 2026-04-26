# Telegram-First Architecture Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o CapDown de uma arquitetura híbrida disco+Telegram para uma arquitetura Telegram-first real, mantendo Axum/SQLite/Rust como engine local e eliminando o disco como fonte funcional principal de páginas.

**Architecture:** O backend atual já tem sinais de transição para Telegram-first (`telegram_only_mode`, `telegram_cache`, páginas com `telegram_file_id`), mas a modelagem ainda é orientada a arquivo local. A migração correta não é trocar stack inteira agora; é separar storage lógico, reader delivery, catálogo e sync Telegram em módulos próprios, reduzir o monólito de `main.rs` e fazer o frontend consumir um contrato único de mídia independente da origem.

**Tech Stack:** Rust, Axum, SQLx, SQLite, React, React Router, Axios, Capacitor (estado atual confirmado); alvo recomendado: Rust + Axum + SQLx + SQLite FTS5 + TDLib adapter + React desktop shell + Android nativo/Kotlin depois da estabilização da API.

---

## Current-State Map

**Backend confirmado no código atual:**
- `backend/src/main.rs`: composição do app, rotas, fila de download, worker pool, jobs
- `backend/src/library.rs`: download de páginas, escrita local, upload Telegram, virtual path `TELEGRAM/...`
- `backend/src/db.rs`: schema SQLite (`mangas`, `chapters`, `pages`, `settings`, `provider_sessions`, `telegram_cache`)
- `backend/src/http.rs`: cliente HTTP e auth externa
- `backend/src/providers/*`: providers de scraping/fetch

**Frontend confirmado no código atual:**
- React + Vite + Axios + React Router + Capacitor em `frontend/package.json`
- tela de settings já conhece `telegram_only_mode`
- frontend ainda consome backend local como fonte única de verdade

**Decisões arquiteturais deste plano:**
1. Manter **Rust + Axum + SQLite** no núcleo local
2. Tratar **Telegram como storage primário de mídia**
3. Tratar **SQLite como catálogo, índice, fila e cache**, não como storage binário principal
4. Fazer o **Reader** consumir um contrato de entrega lógico, não caminhos de disco
5. Adiar a decisão de **TDLib full** para depois da extração do boundary Telegram, em vez de enfiar TDLib dentro do monólito atual de uma vez

---

## Proposed File Structure

### Backend files to create
- Create: `backend/src/telegram/mod.rs`
- Create: `backend/src/telegram/client.rs`
- Create: `backend/src/telegram/cache.rs`
- Create: `backend/src/telegram/media.rs`
- Create: `backend/src/reader/mod.rs`
- Create: `backend/src/reader/service.rs`
- Create: `backend/src/catalog/mod.rs`
- Create: `backend/src/catalog/service.rs`
- Create: `backend/src/jobs/mod.rs`
- Create: `backend/src/jobs/downloads.rs`
- Create: `backend/src/routes/mod.rs`
- Create: `backend/src/routes/library.rs`
- Create: `backend/src/routes/settings.rs`
- Create: `backend/src/routes/downloads.rs`
- Create: `backend/src/routes/reader.rs`
- Create: `backend/src/models/media.rs`
- Create: `backend/tests/telegram_reader_tests.rs`
- Create: `backend/tests/catalog_integrity_tests.rs`

### Backend files to modify
- Modify: `backend/src/main.rs`
- Modify: `backend/src/library.rs`
- Modify: `backend/src/db.rs`
- Modify: `backend/src/models.rs`

### Frontend files to create
- Create: `frontend/src/store/appStore.js`
- Create: `frontend/src/api/queryClient.js`
- Create: `frontend/src/hooks/useLibraryQuery.js`
- Create: `frontend/src/hooks/useReaderQuery.js`
- Create: `frontend/src/hooks/useDownloadsQuery.js`

### Frontend files to modify
- Modify: `frontend/package.json`
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/src/pages/ReaderView.jsx`
- Modify: `frontend/src/pages/MangaDetail.jsx`
- Modify: `frontend/src/pages/SettingsPage.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/App.jsx`

---

### Task 1: Introduzir contrato explícito de storage e entrega de mídia

**Files:**
- Create: `backend/src/models/media.rs`
- Modify: `backend/src/models.rs`
- Test: `backend/tests/catalog_integrity_tests.rs`

- [ ] **Step 1: Criar teste de serialização do novo contrato de mídia**

```rust
use capdown_server::models::media::{MediaLocation, MediaPageRef, StorageKind};

#[test]
fn media_page_ref_serializes_telegram_variant() {
    let page = MediaPageRef {
        index: 1,
        storage: StorageKind::Telegram,
        location: MediaLocation::Telegram {
            file_id: "file-123".into(),
            message_id: Some(10),
            cache_key: Some("chapter-1/001".into()),
        },
        mime_type: Some("image/jpeg".into()),
        width: None,
        height: None,
    };

    let json = serde_json::to_value(&page).unwrap();
    assert_eq!(json["storage"], "telegram");
    assert_eq!(json["location"]["file_id"], "file-123");
}
```

- [ ] **Step 2: Rodar teste para garantir falha inicial**

Run: `cargo test media_page_ref_serializes_telegram_variant --test catalog_integrity_tests`
Expected: FAIL com arquivo/tipo inexistente.

- [ ] **Step 3: Criar o contrato novo em `backend/src/models/media.rs`**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StorageKind {
    Local,
    Telegram,
    Mixed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum MediaLocation {
    Local {
        relative_path: String,
    },
    Telegram {
        file_id: String,
        message_id: Option<i64>,
        cache_key: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MediaPageRef {
    pub index: i32,
    pub storage: StorageKind,
    pub location: MediaLocation,
    pub mime_type: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
}
```

- [ ] **Step 4: Reexportar o módulo em `backend/src/models.rs`**

```rust
pub mod media;
pub use media::{MediaLocation, MediaPageRef, StorageKind};
```

- [ ] **Step 5: Rodar teste para garantir que passa**

Run: `cargo test media_page_ref_serializes_telegram_variant --test catalog_integrity_tests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/models.rs backend/src/models/media.rs backend/tests/catalog_integrity_tests.rs
git commit -m "feat: add explicit media storage contract"
```

### Task 2: Extrair boundary Telegram do `library.rs`

**Files:**
- Create: `backend/src/telegram/mod.rs`
- Create: `backend/src/telegram/client.rs`
- Create: `backend/src/telegram/cache.rs`
- Create: `backend/src/telegram/media.rs`
- Modify: `backend/src/library.rs`
- Modify: `backend/src/main.rs`
- Test: `backend/tests/telegram_reader_tests.rs`

- [ ] **Step 1: Criar teste do client Telegram isolado**

```rust
use capdown_server::telegram::media::TelegramUploadResult;

#[test]
fn telegram_upload_result_keeps_identifiers() {
    let result = TelegramUploadResult {
        file_id: "abc".into(),
        message_id: 99,
        mime_type: Some("image/webp".into()),
    };

    assert_eq!(result.file_id, "abc");
    assert_eq!(result.message_id, 99);
    assert_eq!(result.mime_type.as_deref(), Some("image/webp"));
}
```

- [ ] **Step 2: Rodar teste para falhar**

Run: `cargo test telegram_upload_result_keeps_identifiers --test telegram_reader_tests`
Expected: FAIL.

- [ ] **Step 3: Criar tipos e trait do gateway Telegram**

```rust
// backend/src/telegram/media.rs
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TelegramUploadResult {
    pub file_id: String,
    pub message_id: i64,
    pub mime_type: Option<String>,
}

#[async_trait::async_trait]
pub trait TelegramGateway: Send + Sync {
    async fn upload_page(
        &self,
        bytes: &[u8],
        file_name: &str,
    ) -> anyhow::Result<TelegramUploadResult>;

    async fn resolve_download_url(&self, file_id: &str) -> anyhow::Result<String>;
}
```

- [ ] **Step 4: Criar implementação HTTP temporária do gateway**

```rust
// backend/src/telegram/client.rs
pub struct BotApiTelegramGateway {
    pub http: crate::http::HttpClient,
    pub bot_token: String,
    pub chat_id: String,
}
```

Implementar `upload_page` chamando a lógica hoje existente em `upload_to_telegram` e `resolve_download_url` via `getFile`.

- [ ] **Step 5: Mover `upload_to_telegram` para o módulo novo e deixar `library.rs` depender da trait**

Trecho alvo em `library.rs`:

```rust
let upload = telegram.upload_page(&final_bytes, &format!("{:03}.{ext}", page.index)).await?;

return Ok(LibraryPage {
    index: page.index,
    file_path: telegram_page_virtual_path(&chapter_id, page.index),
    telegram_file_id: Some(upload.file_id),
    telegram_message_id: Some(upload.message_id),
});
```

- [ ] **Step 6: Rodar testes do backend focados em Telegram**

Run: `cargo test telegram -- --nocapture`
Expected: PASS nos testes de módulo Telegram e nenhuma regressão em `library.rs`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/telegram backend/src/library.rs backend/src/main.rs backend/tests/telegram_reader_tests.rs
git commit -m "refactor: extract telegram gateway boundary"
```

### Task 3: Criar serviço de Reader orientado a mídia, não a path físico

**Files:**
- Create: `backend/src/reader/mod.rs`
- Create: `backend/src/reader/service.rs`
- Modify: `backend/src/main.rs`
- Modify: `backend/src/db.rs`
- Test: `backend/tests/telegram_reader_tests.rs`

- [ ] **Step 1: Criar teste para resolver página Telegram em URL de leitura**

```rust
use capdown_server::models::media::{MediaLocation, MediaPageRef, StorageKind};
use capdown_server::reader::service::ReaderDelivery;

#[test]
fn reader_delivery_marks_telegram_pages_as_remote() {
    let page = MediaPageRef {
        index: 1,
        storage: StorageKind::Telegram,
        location: MediaLocation::Telegram {
            file_id: "file-1".into(),
            message_id: Some(7),
            cache_key: Some("c1/001".into()),
        },
        mime_type: Some("image/jpeg".into()),
        width: None,
        height: None,
    };

    let delivery = ReaderDelivery::from_page_ref(&page, "/api/reader/pages/telegram/file-1");
    assert_eq!(delivery.index, 1);
    assert_eq!(delivery.src, "/api/reader/pages/telegram/file-1");
    assert_eq!(delivery.storage, "telegram");
}
```

- [ ] **Step 2: Rodar teste para falhar**

Run: `cargo test reader_delivery_marks_telegram_pages_as_remote --test telegram_reader_tests`
Expected: FAIL.

- [ ] **Step 3: Implementar `ReaderDelivery`**

```rust
#[derive(Debug, Clone, Serialize)]
pub struct ReaderDelivery {
    pub index: i32,
    pub src: String,
    pub storage: &'static str,
}

impl ReaderDelivery {
    pub fn from_page_ref(page: &MediaPageRef, src: &str) -> Self {
        let storage = match page.storage {
            StorageKind::Local => "local",
            StorageKind::Telegram => "telegram",
            StorageKind::Mixed => "mixed",
        };

        Self {
            index: page.index,
            src: src.to_string(),
            storage,
        }
    }
}
```

- [ ] **Step 4: Criar endpoint de reader dedicado**

Adicionar em `backend/src/main.rs` rota separada:

```rust
.route("/api/reader/chapters/:id", get(get_reader_chapter))
.route("/api/reader/pages/telegram/:file_id", get(stream_telegram_page))
```

- [ ] **Step 5: Fazer `stream_telegram_page` usar gateway/cache, não `library_page`**

Comportamento alvo:
- resolve `file_id` -> URL Telegram
- baixa bytes
- responde com `Content-Type` correto
- opcionalmente atualiza `telegram_cache`

- [ ] **Step 6: Rodar testes focados**

Run: `cargo test reader -- --nocapture`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/reader backend/src/main.rs backend/src/db.rs backend/tests/telegram_reader_tests.rs
git commit -m "feat: add reader service for telegram-backed pages"
```

### Task 4: Trocar integridade e catálogo para disponibilidade lógica

**Files:**
- Create: `backend/src/catalog/mod.rs`
- Create: `backend/src/catalog/service.rs`
- Modify: `backend/src/db.rs`
- Modify: `backend/src/main.rs`
- Test: `backend/tests/catalog_integrity_tests.rs`

- [ ] **Step 1: Criar teste para capítulo válido sem arquivo local**

```rust
#[tokio::test]
async fn integrity_accepts_telegram_only_chapter_with_all_file_ids() {
    let temp = tempfile::tempdir().unwrap();
    let db = capdown_server::db::init_db(&temp.path().join("library.db")).await.unwrap();

    // inserir manga, capítulo e 2 páginas com telegram_file_id preenchido
    // chamar verify_integrity(..., true)
    // esperar zero reports
}
```

- [ ] **Step 2: Rodar teste e confirmar comportamento esperado**

Run: `cargo test integrity_accepts_telegram_only_chapter_with_all_file_ids --test catalog_integrity_tests`
Expected: PASS depois da implementação.

- [ ] **Step 3: Criar `CatalogHealth` e separar integridade do SQL cru**

```rust
pub struct CatalogHealthReport {
    pub chapter_id: String,
    pub issue: String,
    pub expected_pages: i64,
    pub stored_pages: i64,
    pub telegram_pages: i64,
}
```

Criar `catalog::service::verify_catalog_health(...)` como wrapper do SQL e deixar `main.rs` depender do serviço, não de `db.rs` diretamente.

- [ ] **Step 4: Introduzir `storage_kind` no catálogo do capítulo**

Modificar schema de `chapters` em `backend/src/db.rs`:

```sql
ALTER TABLE chapters ADD COLUMN storage_kind TEXT NOT NULL DEFAULT 'local';
```

Atualizar persistência para gravar `telegram`, `local` ou `mixed`.

- [ ] **Step 5: Rodar bateria de integridade**

Run: `cargo test verify_integrity -- --nocapture`
Expected: PASS em todos os testes de integridade e catálogo.

- [ ] **Step 6: Commit**

```bash
git add backend/src/catalog backend/src/db.rs backend/src/main.rs backend/tests/catalog_integrity_tests.rs
git commit -m "refactor: verify logical catalog availability instead of disk artifacts"
```

### Task 5: Dividir `main.rs` em rotas e jobs com fronteiras claras

**Files:**
- Create: `backend/src/routes/mod.rs`
- Create: `backend/src/routes/library.rs`
- Create: `backend/src/routes/settings.rs`
- Create: `backend/src/routes/downloads.rs`
- Create: `backend/src/routes/reader.rs`
- Create: `backend/src/jobs/mod.rs`
- Create: `backend/src/jobs/downloads.rs`
- Modify: `backend/src/main.rs`
- Test: `backend/tests/telegram_reader_tests.rs`

- [ ] **Step 1: Escrever teste mínimo de composição do router**

```rust
#[tokio::test]
async fn app_router_exposes_reader_and_library_routes() {
    let app = capdown_server::routes::build_router(test_state()).await;
    let _ = app;
    assert!(true);
}
```

- [ ] **Step 2: Rodar teste para falhar**

Run: `cargo test app_router_exposes_reader_and_library_routes --test telegram_reader_tests`
Expected: FAIL.

- [ ] **Step 3: Extrair construtores de router**

Criar em `backend/src/routes/mod.rs`:

```rust
pub fn build_router(state: AppState) -> Router {
    Router::new()
        .merge(routes::library::router())
        .merge(routes::downloads::router())
        .merge(routes::settings::router())
        .merge(routes::reader::router())
        .with_state(state)
}
```

- [ ] **Step 4: Extrair worker/download job de `main.rs`**

Mover `run_worker_pool` e `run_download_job` para `backend/src/jobs/downloads.rs`.

- [ ] **Step 5: Reduzir `main.rs` a bootstrap**

Objetivo: `main.rs` fica com composição de `AppState`, bootstrap de infraestrutura e `axum::serve`, sem regra de negócio de download/reader.

- [ ] **Step 6: Rodar testes do backend inteiro**

Run: `$env:CAPDOWN_VERDINHA_BEARER='test-token'; cargo test -- --skip debug_verdinha_capitulo_365166`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main.rs backend/src/routes backend/src/jobs
git commit -m "refactor: split routes and jobs out of main"
```

### Task 6: Modernizar a camada de dados do frontend para reduzir acoplamento e lag

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/api/queryClient.js`
- Create: `frontend/src/store/appStore.js`
- Create: `frontend/src/hooks/useLibraryQuery.js`
- Create: `frontend/src/hooks/useReaderQuery.js`
- Create: `frontend/src/hooks/useDownloadsQuery.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/api/client.js`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/MangaDetail.jsx`
- Modify: `frontend/src/pages/ReaderView.jsx`

- [ ] **Step 1: Adicionar dependências de query/store**

Atualizar `frontend/package.json`:

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.90.0",
    "zustand": "^5.0.8"
  }
}
```

- [ ] **Step 2: Instalar dependências**

Run: `npm install`
Expected: lockfile atualizado sem erro.

- [ ] **Step 3: Criar client de query**

```javascript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 4: Criar store mínima de UI**

```javascript
import { create } from 'zustand';

export const useAppStore = create((set) => ({
  selectedProvider: 'verdinha',
  setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
}));
```

- [ ] **Step 5: Migrar `ReaderView.jsx` para query dedicada**

Contrato alvo:

```javascript
export function useReaderQuery(chapterId) {
  return useQuery({
    queryKey: ['reader', chapterId],
    queryFn: () => api.getReaderChapter(chapterId).then((r) => r.data),
    enabled: Boolean(chapterId),
  });
}
```

- [ ] **Step 6: Rodar lint e build**

Run: `npm run lint && npm run build`
Expected: ambos passam.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/api frontend/src/store frontend/src/hooks frontend/src/pages frontend/src/App.jsx
git commit -m "refactor: move frontend data flow to query and store boundaries"
```

### Task 7: Preparar a troca do adapter Telegram HTTP para TDLib

**Files:**
- Create: `docs/architecture/telegram-adapter-boundary.md`
- Modify: `backend/src/telegram/mod.rs`
- Test: nenhum novo teste funcional nesta tarefa

- [ ] **Step 1: Documentar o boundary do adapter Telegram**

Criar `docs/architecture/telegram-adapter-boundary.md` com esta tabela:

```md
| Capability | Bot API adapter | TDLib adapter futuro |
| --- | --- | --- |
| Upload page | sim | sim |
| Resolve file URL | sim | sim |
| Topic/channel management | parcial | forte |
| Media consistency | fraca | forte |
| Session auth complexa | fraca | forte |
```

- [ ] **Step 2: Congelar interface do gateway**

Garantir que `backend/src/telegram/mod.rs` exporta só contratos estáveis:

```rust
pub mod client;
pub mod cache;
pub mod media;

pub use media::{TelegramGateway, TelegramUploadResult};
```

- [ ] **Step 3: Rodar verificação do backend**

Run: `cargo check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/telegram-adapter-boundary.md backend/src/telegram/mod.rs
git commit -m "docs: freeze telegram adapter boundary for tdlib migration"
```

### Task 8: Validação arquitetural final e limpeza de legado

**Files:**
- Modify: nenhum arquivo específico; esta tarefa executa auditoria e remoção controlada

- [ ] **Step 1: Procurar resíduos de arquitetura disco-first**

Run: `Get-ChildItem -Recurse backend\src,frontend\src -File | Select-String -Pattern 'cbz|prepare-telegram|library_page|save_cover|local_dir'`
Expected: lista explícita de pontos remanescentes para classificação.

- [ ] **Step 2: Classificar cada resíduo**

Criar checklist interno:
- remover agora
- remover após validação
- manter temporariamente com motivo

- [ ] **Step 3: Rodar validação completa**

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

- [ ] **Step 4: Registrar decisão arquitetural final**

Adicionar no PR/nota de release:
- Telegram é storage primário
- SQLite é índice local
- disco deixa de ser artefato principal de leitura
- adapter Telegram ainda é Bot API encapsulado, pronto para TDLib depois

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: finalize telegram-first architecture migration"
```

---

## Self-Review

**Spec coverage:**
- Stack absurda para full Telegram: coberta na arquitetura e no boundary TDLib
- Ordem de migração sem quebrar tudo: coberta nas Tasks 1-8
- Manter coerência com código atual: coberto pelo mapeamento do estado atual e pelos arquivos reais existentes

**Placeholder scan:**
- Não há `TODO`, `TBD` ou “implementar depois” sem direção; a única postergação explícita é a troca futura para TDLib, protegida por boundary congelado

**Type consistency:**
- `StorageKind`, `MediaLocation`, `MediaPageRef`, `TelegramGateway`, `ReaderDelivery` e `CatalogHealthReport` mantêm nomes consistentes entre tarefas
