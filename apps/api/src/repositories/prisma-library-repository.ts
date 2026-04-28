import { PrismaClient } from '@prisma/client';
import { 
  type LibraryIndex, 
  type LibraryManga, 
  type ReaderChapterPayload, 
  type VerifyLibraryResponse, 
  type AuditMangaResponse, 
  type PrepareTelegramResponse, 
  type SyncMangaResponse,
  type LibraryChapter
} from "@capdown/contracts";
import { type ILibraryRepository } from "./interfaces.js";
import { AppError } from "../store/errors.js";
import { telegramBot } from "../services/telegram-bot.js";

export class PrismaLibraryRepository implements ILibraryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listLibrary(): Promise<LibraryIndex> {
    const manga = await this.prisma.libraryManga.findMany({
      include: {
        chapters: {
          include: { pages: true }
        }
      },
      orderBy: { title: 'asc' }
    });

    return {
      version: 1,
      manga: manga.map(m => this.mapToContractManga(m))
    };
  }

  async getManga(id: string): Promise<LibraryManga | null> {
    const manga = await this.prisma.libraryManga.findUnique({
      where: { id },
      include: {
        chapters: {
          include: { pages: true }
        }
      }
    });

    return manga ? this.mapToContractManga(manga) : null;
  }

  async upsertManga(manga: LibraryManga): Promise<LibraryManga> {
    const updated = await this.prisma.$transaction(async (tx) => {
      // Upsert Manga
      const m = await tx.libraryManga.upsert({
        where: { id: manga.id },
        update: {
          provider_id: manga.provider_id,
          media_type: manga.media_type,
          source_id: manga.source_id,
          source_url: manga.source_url,
          title: manga.title,
          cover_url: manga.cover_url,
        },
        create: {
          id: manga.id,
          provider_id: manga.provider_id,
          media_type: manga.media_type,
          source_id: manga.source_id,
          source_url: manga.source_url,
          title: manga.title,
          cover_url: manga.cover_url,
        }
      });

      // Handle Chapters
      for (const chapter of manga.chapters) {
        const c = await tx.libraryChapter.upsert({
          where: { id: chapter.id },
          update: {
            source_id: chapter.source_id,
            title: chapter.title,
            number: chapter.number,
            source_url: chapter.source_url,
            page_count: chapter.page_count,
            downloaded_at: new Date(chapter.downloaded_at),
          },
          create: {
            id: chapter.id,
            source_id: chapter.source_id,
            title: chapter.title,
            number: chapter.number,
            source_url: chapter.source_url,
            page_count: chapter.page_count,
            downloaded_at: new Date(chapter.downloaded_at),
            manga_id: m.id,
          }
        });

        // Handle Pages - simplified: delete all and recreate or upsert
        // For simplicity and speed in SQLite, delete and createMany if pages changed
        await tx.libraryPage.deleteMany({ where: { chapter_id: c.id } });
        if (chapter.pages && chapter.pages.length > 0) {
          for (const page of chapter.pages) {
            await tx.libraryPage.create({
              data: {
                index: page.index,
                telegram_file_id: page.telegram_file_id,
                telegram_message_id: page.telegram_message_id,
                chapter_id: c.id,
              }
            });
          }
        }
      }

      return tx.libraryManga.findUnique({
        where: { id: manga.id },
        include: {
          chapters: {
            include: { pages: true }
          }
        }
      });
    });

    return this.mapToContractManga(updated!);
  }

  async deleteManga(id: string) {
    await this.prisma.libraryManga.delete({ where: { id } });
    return { status: "ok" };
  }

  async getReaderChapterPayload(mangaId: string, chapterId: string): Promise<ReaderChapterPayload> {
    const manga = await this.prisma.libraryManga.findUnique({
      where: { id: mangaId },
      include: {
        chapters: {
          include: { pages: true },
          orderBy: { downloaded_at: 'asc' } // Placeholder for sorting
        }
      }
    });

    if (!manga) throw new AppError(404, "manga_not_found", "Manga not found");

    const chapters = [...manga.chapters].sort(this.compareChaptersByNumber);
    const chapterIndex = chapters.findIndex((c) => c.id === chapterId);
    if (chapterIndex === -1) throw new AppError(404, "chapter_not_found", "Chapter not found");

    const chapter = chapters[chapterIndex];
    const prevChapter = chapters[chapterIndex - 1] || null;
    const nextChapter = chapters[chapterIndex + 1] || null;

    return {
      manga_id: manga.id,
      manga_title: manga.title,
      chapter: this.mapToContractChapter(chapter),
      pages: chapter.pages.map(p => ({
        index: p.index,
        telegram_file_id: p.telegram_file_id,
        telegram_message_id: p.telegram_message_id
      })),
      prev_chapter: prevChapter ? { id: prevChapter.id, title: prevChapter.title, number: prevChapter.number } : null,
      next_chapter: nextChapter ? { id: nextChapter.id, title: nextChapter.title, number: nextChapter.number } : null,
    };
  }

  async verifyLibrary(): Promise<VerifyLibraryResponse> {
    const manga = await this.prisma.libraryManga.findMany({
      include: {
        chapters: {
          include: { pages: true }
        }
      }
    });

    const reports = manga.flatMap((m) =>
      m.chapters.flatMap((chapter) => {
        const telegramPages = chapter.pages.filter((page) => page.telegram_message_id !== null).length;
        const issues: any[] = [];

        if (chapter.page_count !== chapter.pages.length) {
          issues.push({
            manga_title: m.title,
            chapter_title: chapter.title,
            chapter_id: chapter.id,
            issue: "pages_missing",
            expected_pages: chapter.page_count,
            telegram_pages: telegramPages,
          });
        }

        if (chapter.pages.length > 0 && telegramPages < chapter.pages.length) {
          issues.push({
            manga_title: m.title,
            chapter_title: chapter.title,
            chapter_id: chapter.id,
            issue: "telegram_missing",
            expected_pages: chapter.page_count,
            telegram_pages: telegramPages,
          });
        }

        return issues;
      }),
    );

    return { reports };
  }

  async auditManga(mangaId: string): Promise<AuditMangaResponse> {
    const manga = await this.prisma.libraryManga.findUnique({
      where: { id: mangaId },
      include: {
        chapters: {
          include: { pages: true }
        }
      }
    });

    if (!manga) throw new AppError(404, "manga_not_found", "Manga not found");

    const discrepancies = manga.chapters.flatMap((chapter) => {
      const telegramPages = chapter.pages.filter((page) => page.telegram_message_id !== null).length;
      const chapterIssues: any[] = [];

      if (chapter.page_count !== chapter.pages.length) {
        chapterIssues.push({
          chapter_id: chapter.id,
          title: chapter.title,
          remote_pages: telegramPages,
          status: "pages_missing",
        });
      }

      if (chapter.pages.length > 0 && telegramPages < chapter.pages.length) {
        chapterIssues.push({
          chapter_id: chapter.id,
          title: chapter.title,
          remote_pages: telegramPages,
          status: "telegram_missing",
        });
      }

      return chapterIssues;
    });

    return {
      manga_id: manga.id,
      manga_title: manga.title,
      discrepancies,
    };
  }

  async prepareTelegram(mangaId: string): Promise<PrepareTelegramResponse> {
    const manga = await this.prisma.libraryManga.findUnique({
      where: { id: mangaId },
      include: {
        chapters: {
          include: { pages: true }
        }
      }
    });

    if (!manga) throw new AppError(404, "manga_not_found", "Manga not found");

    let uploadedPages = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const [chapterIndex, chapter] of manga.chapters.entries()) {
        for (const [pageIndex, page] of chapter.pages.entries()) {
          if (page.telegram_message_id === null) {
            const fakeId = chapterIndex * 1000 + pageIndex + 1;
            await tx.libraryPage.update({
              where: { id: page.id },
              data: { telegram_message_id: fakeId }
            });
            uploadedPages += 1;
          }
        }
      }
      
      await tx.libraryManga.update({
        where: { id: mangaId },
        data: { updated_at: new Date() }
      });
    });

    return {
      status: "ok",
      uploaded_pages: uploadedPages,
      failed_pages: [],
    };
  }

  async syncManga(mangaId: string): Promise<SyncMangaResponse> {
    return {
      status: "ok",
      count: 0,
      imported: [],
    };
  }

  async getTelegramPageImage(chapterId: string, pageIndex: number): Promise<{ contentType: string; body: string | Buffer }> {
    const chapter = await this.prisma.libraryChapter.findUnique({
      where: { id: chapterId },
      include: { 
        manga: true,
        pages: true
      }
    });

    if (!chapter) throw new AppError(404, "page_not_found", "Page not found");

    const page = chapter.pages.find((entry) => entry.index === pageIndex);
    if (!page) throw new AppError(404, "page_not_found", "Page not found");

    if (page.telegram_file_id && page.telegram_file_id.length > 5) {
      try {
        const fileUrl = await telegramBot.getFileUrl(page.telegram_file_id);
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error("Failed to fetch from Telegram");
        const arrayBuffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "image/jpeg";
        return {
          contentType,
          body: Buffer.from(arrayBuffer),
        };
      } catch (err) {
        console.error(`Failed to load telegram file ${page.telegram_file_id}:`, err);
        // Fallback to SVG error
      }
    }

    const svg = this.buildPageSvg({
      mangaTitle: chapter.manga.title,
      chapterTitle: chapter.title,
      chapterNumber: chapter.number,
      pageIndex,
      pageCount: chapter.pages.length,
      telegramMessageId: page.telegram_message_id,
      prepared: page.telegram_message_id !== null,
    });

    return {
      contentType: "image/svg+xml; charset=utf-8",
      body: svg,
    };
  }

  async upsertLibraryPage(chapterId: string, pageIndex: number, telegramFileId: string): Promise<void> {
    await this.prisma.libraryPage.upsert({
      where: {
        chapter_id_index: {
          chapter_id: chapterId,
          index: pageIndex
        }
      },
      update: {
        telegram_file_id: telegramFileId
      },
      create: {
        chapter_id: chapterId,
        index: pageIndex,
        telegram_file_id: telegramFileId
      }
    });
  }

  private mapToContractManga(m: any): LibraryManga {
    return {
      id: m.id,
      provider_id: m.provider_id as any,
      media_type: m.media_type as any,
      source_id: m.source_id,
      source_url: m.source_url,
      title: m.title,
      cover_url: m.cover_url,
      updated_at: m.updated_at.toISOString(),
      chapters: (m.chapters || []).map((c: any) => this.mapToContractChapter(c))
    };
  }

  private mapToContractChapter(c: any): any {
    return {
      id: c.id,
      source_id: c.source_id,
      title: c.title,
      number: c.number,
      source_url: c.source_url,
      page_count: c.page_count,
      downloaded_at: c.downloaded_at.toISOString(),
      pages: (c.pages || []).map((p: any) => ({
        index: p.index,
        telegram_file_id: p.telegram_file_id,
        telegram_message_id: p.telegram_message_id
      }))
    };
  }

  private buildPageSvg(input: any) {
    const escape = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");

    const statusText = input.prepared
      ? `telegram #${input.telegramMessageId}`
      : "page preparada localmente";

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1440" viewBox="0 0 960 1440" role="img" aria-labelledby="title desc">
  <title id="title">CapDown transitional page</title>
  <desc id="desc">Placeholder page for ${escape(input.mangaTitle)} chapter ${escape(input.chapterTitle)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0f120f"/>
      <stop offset="100%" stop-color="#1c2318"/>
    </linearGradient>
  </defs>
  <rect width="960" height="1440" fill="url(#bg)"/>
  <rect x="56" y="56" width="848" height="1328" rx="28" fill="#10130f" stroke="#b6ff5f" stroke-width="3"/>
  <text x="96" y="160" fill="#b6ff5f" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="28" font-weight="700">CapDown transitional page</text>
  <text x="96" y="236" fill="#f5f5f0" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="44" font-weight="700">${escape(input.mangaTitle)}</text>
  <text x="96" y="298" fill="#d7dccf" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="28">${escape(input.chapterTitle)}${input.chapterNumber ? ` · cap. ${escape(input.chapterNumber)}` : ""}</text>
  <text x="96" y="368" fill="#d7dccf" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24">Pagina ${input.pageIndex} de ${input.pageCount}</text>
  <text x="96" y="444" fill="#b6ff5f" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="22">${escape(statusText)}</text>
  <rect x="96" y="520" width="768" height="680" rx="20" fill="#151a14" stroke="#2f3c2a" stroke-width="2"/>
  <text x="480" y="860" text-anchor="middle" fill="#6f7a66" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="32">Imagem transitória sem backend de mídia</text>
</svg>`;
  }

  private compareChaptersByNumber(left: any, right: any) {
    const leftNumber = left.number === null ? null : Number(left.number);
    const rightNumber = right.number === null ? null : Number(right.number);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
      return (leftNumber as number) - (rightNumber as number);
    }

    if (Number.isFinite(leftNumber)) return -1;
    if (Number.isFinite(rightNumber)) return 1;

    const titleComparison = left.title.localeCompare(right.title, "pt-BR", { numeric: true, sensitivity: "base" });
    if (titleComparison !== 0) return titleComparison;

    return left.source_id.localeCompare(right.source_id, "pt-BR", { numeric: true, sensitivity: "base" });
  }
}
