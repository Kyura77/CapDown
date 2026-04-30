# 06 — CAPDOWN: Telegram Granular V2

## Crítica ao Plano Atual

O plano `2026-04-27-telegram-granular-plan.md` tem 16 tasks. Problemas:

1. **Tasks 12-16 são escopo totalmente diferente** (Anilist OAuth, Kids Filter, TomatoDown com MTProto). Não têm relação com "granularidade de downloads".
2. **Task 10 (rotação de bots)** é urgente mas tratada como task 10 de 16 — deveria ser task 2.
3. **Sem tratamento de falha de rede em upload** — se o Telegram rejeitar a página 47 de 80, o que acontece?
4. **Sem idempotência** — se o worker reiniciar durante upload, vai re-enviar páginas já enviadas?
5. **Sem handling de arquivo maior que 50MB** — limite do bot Telegram. Páginas HD podem passar disso em grupos.
6. **Fóruns (Topics)** exigem que o chat seja um supergrupo com topics habilitados — sem verificação disso.
7. **`npx prisma db push`** nos passos — perigoso em produção.

---

## Arquitetura Robusta

### Schema Sugerido (migration incremental)

```prisma
// Substitui DownloadJob monolítico
model ChapterDownloadJob {
  id               String   @id @default(cuid())
  manga_id         String
  manga_title      String
  chapter_id       String
  chapter_number   String?
  chapter_title    String
  source_url       String
  provider_id      String
  
  status           String   @default("queued")
  // queued | downloading | uploading | completed | failed | retrying
  
  retry_count      Int      @default(0)
  max_retries      Int      @default(3)
  last_error       String?
  error_kind       String?  // network | telegram_rate_limit | provider_error | unknown
  
  downloaded_pages Int      @default(0)
  total_pages      Int      @default(0)
  
  // Idempotência: páginas já enviadas não são reenviadas
  uploaded_pages_json String? // JSON: {pageIndex: telegramFileId}
  
  telegram_topic_id   Int?
  telegram_message_id Int?   // Mensagem de índice do capítulo no tópico
  
  // Scheduling
  priority         Int      @default(5)  // 1 (alta) - 10 (baixa)
  scheduled_at     DateTime @default(now())
  started_at       DateTime?
  completed_at     DateTime?
  
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
  
  @@unique([manga_id, chapter_id])
  @@index([status, priority])
  @@index([manga_id, status])
}

model TelegramBotConfig {
  id           String   @id @default(cuid())
  token        String
  chat_id      String
  active       Boolean  @default(true)
  request_count_today Int @default(0)
  last_used_at DateTime?
  daily_limit  Int      @default(1000)
}
```

---

## Pipeline Idempotente

O princípio fundamental: **cada operação é idempotente**. Reiniciar o worker em qualquer ponto não gera dados duplicados.

```typescript
class ChapterDownloadWorker {
  async processChapterJob(jobId: string): Promise<void> {
    const job = await this.repo.getChapterJob(jobId);
    if (!job || job.status === 'completed') return; // Idempotente
    
    // 1. Carregar progresso existente
    const uploadedPages: Record<number, string> = job.uploaded_pages_json
      ? JSON.parse(job.uploaded_pages_json)
      : {};
    
    await this.repo.updateStatus(jobId, 'downloading');
    
    // 2. Buscar páginas (sempre busca de novo — URLs podem expirar)
    const pages = await this.scraperClient.getPages(job.source_url, job.provider_id);
    await this.repo.setTotalPages(jobId, pages.length);
    
    // 3. Para cada página — PULA SE JÁ ENVIADA
    for (const page of pages) {
      if (uploadedPages[page.index]) {
        logger.debug({ jobId, pageIndex: page.index }, 'page already uploaded, skipping');
        continue;
      }
      
      const buffer = await this.fetchPageWithRetry(page);
      const fileId = await this.telegramStorage.upload(buffer, page.filename, {
        chatId: this.settings.chat_id,
        topicId: job.telegram_topic_id ?? undefined,
      });
      
      // Salvar progresso IMEDIATAMENTE após cada página
      uploadedPages[page.index] = fileId;
      await this.repo.recordPageUploaded(jobId, page.index, fileId, uploadedPages);
    }
    
    await this.repo.updateStatus(jobId, 'completed');
    await this.notifyTelegram(job, pages.length);
  }
}
```

---

## Handling de Mídia e Limite de 50MB

```typescript
class TelegramStorageService {
  private readonly MAX_FILE_SIZE_BYTES = 49 * 1024 * 1024; // 49MB com margem
  
  async upload(buffer: Buffer, filename: string, opts: UploadOptions): Promise<string> {
    if (buffer.length > this.MAX_FILE_SIZE_BYTES) {
      // Estratégia: comprimir PNG para JPEG se for imagem
      const compressed = await this.compressImage(buffer, { quality: 85 });
      if (compressed.length > this.MAX_FILE_SIZE_BYTES) {
        throw new UploadError('file_too_large', `${filename} exceeds Telegram 50MB limit after compression`);
      }
      return this.uploadDocument(compressed, filename.replace('.png', '.jpg'), opts);
    }
    return this.uploadDocument(buffer, filename, opts);
  }
  
  private async uploadDocument(buffer: Buffer, filename: string, opts: UploadOptions): Promise<string> {
    const bot = await this.getBotForRequest(); // Rotação de bots
    // ... FormData upload com Retry-After handling
  }
  
  private async getBotForRequest(): Promise<TelegramBotConfig> {
    const bots = await this.repo.getActiveBots();
    // Round-robin baseado em request_count_today e daily_limit
    return bots.reduce((best, current) => 
      current.request_count_today < current.daily_limit ? current : best
    );
  }
}
```

---

## Retry e Backoff

```typescript
async function uploadWithBackoff(
  fn: () => Promise<string>,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      
      if (err instanceof TelegramRateLimitError) {
        await sleep(err.retryAfterMs); // Respeitar Retry-After
        continue;
      }
      
      if (err instanceof TelegramFloodError) {
        await sleep(Math.min(60_000, 5000 * 2 ** attempt)); // Backoff agressivo
        continue;
      }
      
      // Erro de rede — backoff exponencial normal
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw new Error('unreachable');
}
```

---

## Verificação de Fórum Antes de Usar Topics

```typescript
async function ensureForumSupport(chatId: string, botToken: string): Promise<boolean> {
  const chat = await getChat(chatId, botToken);
  return chat.is_forum === true;
}

// Se não for fórum: todas as mensagens vão pro chat principal
// Se for fórum: criar tópico por manga
async function getOrCreateMangaTopic(mangaTitle: string, chatId: string): Promise<number | null> {
  const isForumChat = await ensureForumSupport(chatId, token);
  if (!isForumChat) return null; // null = sem tópico, usa chat principal
  // ... criar ou buscar tópico existente
}
```

---

## Observabilidade do Pipeline

```typescript
// Cada operação do pipeline loga:
logger.info({
  job_id: job.id,
  manga_title: job.manga_title,
  chapter_number: job.chapter_number,
  operation: 'page_upload',
  page_index: page.index,
  total_pages: pages.length,
  duration_ms: Date.now() - pageStart,
  file_size_bytes: buffer.length,
  bot_used: botConfig.id,
  retry_count: attempt,
}, 'page uploaded');

// Métricas agregadas por job:
// - total_duration_ms
// - pages_per_second
// - bytes_uploaded
// - retry_count_total
// - bot_distribution: {bot1: 30, bot2: 20}
```

---

## Tasks Cortadas do Plano Original

Estas tasks do plano original devem ser **movidas para projetos separados ou descartadas**:

| Task | Motivo do Corte |
|------|-----------------|
| Task 12 — Anilist OAuth | Projeto diferente. Sem relação com pipeline de download. |
| Task 13 — Kids Filter | Feature de produto. Não bloqueante. Baixa demanda. |
| Task 14 — Pins Favoritos Telegram | Nice-to-have cosmético. |
| Task 16 — TomatoDown (Animes) | Projeto completamente diferente. MTProto é outra stack. |

---

## Plano de Implementação por Fases

### Sprint 1 — Schema e Worker (1 semana)
1. Criar `ChapterDownloadJob` no schema via `prisma migrate dev`
2. Deprecar (não deletar) `DownloadJob`
3. Implementar `ChapterDownloadWorker` com idempotência
4. Testes: job interrompido e retomado mantém páginas já enviadas

### Sprint 2 — Telegram Robusto (1 semana)
1. Implementar `TelegramStorageService` com compressão e limite de tamanho
2. Implementar rotação de bots (`TelegramBotConfig` multi-token)
3. Implementar `Retry-After` handling
4. Implementar `getBotForRequest()` round-robin

### Sprint 3 — Forum Topics e Notificações (3 dias)
1. Verificação de suporte a forum antes de criar tópicos
2. Criar/reusar tópico por manga
3. Mensagem de status do capítulo com botões RETRY/DEL

### Sprint 4 — Radar de Updates (3 dias)
1. BullMQ repeatable job a cada 6h
2. Para cada `LibraryManga`: buscar capítulos mais novos que o último salvo
3. Criar `ChapterDownloadJob` para novos capítulos
4. Notificação Telegram: "X novos capítulos encontrados"

### Sprint 5 — Backup DB (2 dias)
1. BullMQ job diário
2. Copiar `dev.db`, gzip, enviar como Document ao Telegram
3. Manter últimos 7 backups

---

## Definição de Pronto

- [ ] Job interrompido e reiniciado não duplica páginas no Telegram
- [ ] Erro 429 do Telegram resulta em espera, não em falha
- [ ] Arquivo > 50MB é comprimido, não rejeitado
- [ ] Múltiplos bots são usados em round-robin
- [ ] Cada operação loga `job_id`, `operation`, `duration_ms`
- [ ] `/api/downloads/:id` retorna status por capítulo, não só por job
- [ ] Radar detecta novo capítulo em até 6h
