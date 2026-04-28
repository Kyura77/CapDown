import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT_DIR = join(__dirname, '../../../../');
const LEGACY_JSON_PATH = join(ROOT_DIR, 'library/index.json.bak');
const APP_STATE_PATH = join(__dirname, '../../data/app-state.json');

async function main() {
  console.log('🚀 Iniciando migração para SQLite...');

  // 1. Migrar Configurações do app-state.json
  if (existsSync(APP_STATE_PATH)) {
    console.log('--- Migrando Settings e Auth ---');
    const appState = JSON.parse(readFileSync(APP_STATE_PATH, 'utf-8'));
    
    await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        telegram_token: appState.settings.telegram_token,
        telegram_chat_id: appState.settings.telegram_chat_id,
      },
      create: {
        id: 'default',
        telegram_token: appState.settings.telegram_token,
        telegram_chat_id: appState.settings.telegram_chat_id,
      }
    });

    for (const account of appState.auth.accounts) {
      await prisma.authAccount.upsert({
        where: { provider_id_username: { provider_id: account.provider_id, username: account.username } },
        update: { password: account.password },
        create: {
          provider_id: account.provider_id,
          username: account.username,
          password: account.password,
          created_at: new Date(account.created_at),
          updated_at: new Date(account.updated_at),
        }
      });
    }

    for (const [providerId, session] of Object.entries(appState.auth.sessions || {})) {
      const s = session as any;
      await prisma.authSession.upsert({
        where: { provider_id: providerId },
        update: {
          connected: s.connected,
          last_solved_at: s.last_solved_at ? new Date(s.last_solved_at) : null,
          url: s.url,
          wait_seconds: s.wait_seconds,
        },
        create: {
          provider_id: providerId,
          connected: s.connected,
          last_solved_at: s.last_solved_at ? new Date(s.last_solved_at) : null,
          url: s.url,
          wait_seconds: s.wait_seconds,
          created_at: new Date(s.created_at || Date.now()),
          updated_at: new Date(s.updated_at || Date.now()),
        }
      });
    }

    // Migrar Downloads ativos
    for (const job of appState.downloads) {
      await prisma.downloadJob.upsert({
        where: { id: job.id },
        update: {},
        create: {
          id: job.id,
          url: job.url,
          status: job.status,
          manga_title: job.manga_title,
          current_chapter: job.current_chapter,
          downloaded_pages: job.downloaded_pages,
          total_pages: job.total_pages,
          downloaded_chapters: job.downloaded_chapters,
          total_chapters: job.total_chapters,
          error: job.error,
          chapters_json: JSON.stringify(job.chapters),
          concurrency: job.concurrency,
          source_manga_id: job.source_manga_id,
          source_chapters_json: JSON.stringify(job.source_chapter_ids),
          source_title: job.source_title,
          source_provider_id: job.source_provider_id,
          terminal_reason: job.terminal_reason,
          created_at: new Date(job.created_at),
          updated_at: new Date(job.updated_at),
        }
      });
    }
  }

  // 2. Migrar Biblioteca do index.json.bak
  if (existsSync(LEGACY_JSON_PATH)) {
    console.log('--- Migrando Biblioteca (Manga/Chapters/Pages) ---');
    const legacyData = JSON.parse(readFileSync(LEGACY_JSON_PATH, 'utf-8'));
    
    for (const manga of legacyData.manga) {
      console.log(`  > Migrando: ${manga.title}`);
      
      const createdManga = await prisma.libraryManga.upsert({
        where: { id: manga.id },
        update: {},
        create: {
          id: manga.id,
          provider_id: manga.provider_id,
          source_id: manga.source_id,
          source_url: manga.source_url,
          title: manga.title,
          cover_url: manga.cover_url,
          media_type: manga.media_type || 'manga',
          updated_at: new Date(),
        }
      });

      for (const chapter of manga.chapters) {
        const createdChapter = await prisma.libraryChapter.upsert({
          where: { id: chapter.id },
          update: {},
          create: {
            id: chapter.id,
            source_id: chapter.source_id,
            title: chapter.title,
            number: chapter.number,
            source_url: chapter.source_url,
            page_count: chapter.pages?.length || 0,
            downloaded_at: new Date(chapter.downloaded_at),
            manga_id: createdManga.id,
          }
        });

        if (chapter.pages && chapter.pages.length > 0) {
          // Bulk create pages for speed
          const pageData = chapter.pages.map((p: any) => ({
            index: p.index,
            telegram_file_id: `legacy_local:${p.file_path}`,
            chapter_id: createdChapter.id,
          }));

          // Prisma SQLite doesn't support createMany easily with relations in some versions,
          // but we can just loop or use createMany if available.
          for (const p of pageData) {
            await prisma.libraryPage.upsert({
              where: { chapter_id_index: { chapter_id: p.chapter_id, index: p.index } },
              update: {},
              create: p
            });
          }
        }
      }
    }
  }

  console.log('✅ Migração finalizada!');
}

main()
  .catch((e) => {
    console.error('❌ Erro na migração:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
