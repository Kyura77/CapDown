\# Telegram Granular Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar CapDown para downloads granulares (Job por CapÃ­tulo), integrar TÃ³picos Telegram, Polling de BotÃµes, Backups, Radar, Export CBZ e Suporte a Novels.

**Architecture:**

1. Database: `ChapterDownloadJob` substitui monolith.
2. BullMQ: Fila `downloads` por capÃ­tulo. Fila `radar` para cron.
3. Telegram: FÃ³runs dinÃ¢micos, Polling para inline buttons.
4. Export/Novels: Stream `.cbz` on-the-fly e armazena text files para novels.

**Tech Stack:** Prisma, BullMQ, Fastify, Telegraf (fetch), React, Python.

---

### FASE 1: Core Telegram e Granularidade

### Task 1: Atualizar o Banco de Dados (Prisma)

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- \[ \] **Step 1: Schema Updates**Adicionar `telegram_topic_id Int?` em `LibraryManga`. Remover `DownloadJob`. Criar `ChapterDownloadJob`:

```prisma
model ChapterDownloadJob {
  id                  String   @id @default(cuid())
  manga_id            String
  manga_title         String
  chapter_id          String   
  chapter_number      String?
  chapter_title       String
  source_url          String
  provider_id         String
  status              String   // queued, downloading, completed, failed
  error               String?
  downloaded_pages    Int      @default(0)
  total_pages         Int      @default(0)
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
  @@unique([manga_id, chapter_id])
}
```

Run: `npx prisma db push`

### Task 2: Atualizar Contratos (Packages)

**Files:**

- Modify: `packages/contracts/src/downloads.ts`

- \[ \] **Step 1: Zod Schemas**Atualizar schema para refletir `ChapterDownloadJob`. Run `npm run build` no `packages/contracts`.

### Task 3: Polling e Fóruns no Telegram Bot Service

**Files:**

- Modify: `apps/api/src/services/telegram-bot.ts`

- \[ \] **Step 1: Bot Methods**Adicionar `createForumTopic`, `sendMessageWithButtons`, e `startPolling(onCallbackQuery)`.

### Task 4: Refatorar Worker e Queue

**Files:**

- Modify: `apps/api/src/services/download-worker.ts`

- Modify: `apps/api/src/queues/download-queue.ts`

- Modify: `apps/api/src/store/product-state-service.ts`

- \[ \] **Step 1: Isolar Jobs**Ajustar `createDownload` para criar múltiplos `ChapterDownloadJob` (um por cap selecionado) e iterar envio pra fila. O Worker processa 1 cap, faz update no banco, e envia log pro Telegram com botões (RETRY_id, DEL_id).

---

### FASE 2: Features Premium

### Task 5: Backup DB Telegram

**Files:**

- Create: `apps/api/src/jobs/backup-cron.ts`

- \[ \] **Step 1: Auto Backup**Usar BullMQ repeatable job (a cada 24h). Copiar `dev.db`, anexar no `sendDocument` pro Telegram (Tópico de Logs).

### Task 6: Radar de Updates

**Files:**

- Create: `apps/api/src/jobs/radar-cron.ts`

- \[ \] **Step 1: Checar Novos Caps**Iterar `LibraryManga`. Chamar scraper. Se `chapter` for novo, injetar no `ProductStateService.createDownload`. Telegram logga sucesso com notificação ativa.

### Task 7: Exportação Local (CBZ)

**Files:**

- Modify: `apps/api/src/routes/library.ts`

- \[ \] **Step 1: Endpoint** `/api/library/manga/:id/export`API busca file_ids no banco, faz stream via JSZip, converte pra Buffer, response header `application/zip`. Frontend adiciona botão "Exportar CBZ".

### Task 8: Estatísticas de Leitura

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- Modify: `apps/api/src/routes/library.ts`

- \[ \] **Step 1: Gravar Progresso**Add `last_read_at DateTime?` e `pages_read Int default(0)` no Model `LibraryManga`. Endpoint `/api/library/progress` recebe batidas do frontend.

### Task 9: Suporte a Novels

**Files:**

- Modify: `apps/scraper/main.py`

- Modify: `apps/api/src/services/download-worker.ts`

- \[ \] **Step 1: Texto via Scraper**Scraper devolve objeto `text_content`. Worker detecta `media_type === 'novel'`, cria `capitulo.txt`, faz upload pro Telegram como documento. Reader web usa `fetch` para ler `.txt` e formata como e-book na tela.

### Task 10: Rotação de Bots (Anti-Rate Limit)

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- Modify: `apps/api/src/services/telegram-bot.ts`

- \[ \] **Step 1: Array de Tokens**Mudar a configuração de `telegram_token` (String) para um array de tokens (salvo em JSON no banco). O `TelegramBotService` fará um "Round Robin" (distribuição circular) selecionando um token diferente a cada request de upload, prevenindo bloqueio HTTP 429.

### Task 11: Pre-load Inteligente no Reader

**Files:**

- Modify: `apps/client/src/pages/ReaderView.jsx`

- \[ \] **Step 1: Hook de Prefetch**Adicionar um `useEffect` que detecta a página atual. Se a página atual for X, ele aciona invisivelmente o request de blob para a página X+1 e X+2, armazenando o object URL no navegador.

### Task 12: Integração Anilist (Novo)

**Files:**

- Create: `apps/api/src/services/anilist.ts`

- Modify: `apps/api/src/routes/library.ts`

- \[ \] **Step 1: Anilist OAuth e Progresso**Criar rotina para conectar conta Anilist. Ao bater o `/api/library/progress`, enviar mutação GraphQL para a API do Anilist atualizando o volume/capítulo do usuário.

### Task 13: CapDown Kids / Family Filter (Novo)

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- Modify: `apps/client/src/pages/Dashboard.jsx`

- \[ \] **Step 1: Filtro de Conteúdo**Adicionar campo `is_nsfw Boolean @default(false)` no `LibraryManga`. Adicionar um "Modo Família" na UI (protegido por PIN local) que esconde obras e histórico marcados como sensíveis.

### Task 14: Sistema de Pins / Bookmarks no Telegram

**Files:**

- Modify: `apps/api/src/services/telegram-bot.ts`

- \[ \] **Step 1: Pinar Obras Favoritas**Obras que o usuário marcar com "Estrela" na UI web terão a mensagem inicial pinada automaticamente no topo do tópico no Telegram, servindo como índice rápido.

### Task 15: Painel de Múltiplos Tokens e Logs (UI/UX)

**Files:**

- Modify: `apps/client/src/pages/SettingsPage.jsx`

- Modify: `apps/api/src/server.ts`

- \[ \] **Step 1: Multi-Token e SSE Server**No Fastify, implementar um endpoint SSE (`/api/logs/stream`) que emite eventos quando o BullMQ atualiza o progresso. Na UI do SettingsPage, transformar o campo de token do Telegram em uma lista onde o usuário pode adicionar/remover tokens, e adicionar um pequeno console na página de Downloads que escuta o SSE e mostra os logs piscando em tempo real.

### Task 16: Projeto "TomatoDown" (Scraper de Vídeos)

**Meta:** Rascunho inicial do projeto irmão focado em animes.

- \[ \] **Step 1: Arquitetura de Bot MTProto**A arquitetura não será REST comum, mas usará o `Telethon` ou `Pyrogram` (UserBots Python) para contornar o limite de 50MB dos bots de API tradicional, permitindo upload de vídeos MP4/MKV de até 2GB.
- \[ \] **Step 2: Scraper Avançado (Playwright**)O módulo de scraper Python usará navegadores headless para interceptar tráfego de rede, resolver descriptografia AES e capturar chaves `.m3u8` diretamente dos players de vídeo da plataforma Tomato e similares.
