import { fetchWithTimeout } from '../utils/http.js';
import { getProviderAdapter } from '../providers/index.js';
import type { ProviderId } from '@capdown/contracts';
import type { IDownloadsRepository, ISettingsRepository, ILibraryRepository } from '../repositories/interfaces.js';
import { telegramBot } from './telegram-bot.js';

export interface DownloadPlanChapter {
  id: string;
  title: string;
  pageCount: number;
  sourceUrl?: string;
}

export interface DownloadPlan {
  jobId: string;
  mangaId: string;
  mangaTitle: string | null;
  sourceProviderId: string | null;
  sourceChapterIds: string[];
  chapters: DownloadPlanChapter[];
  totalPages: number;
  totalChapters: number;
}

interface DownloadPage {
  url: string;
  filename: string;
  index: number;
}

export type ProgressCallback = (progress: {
  downloadedPages: number;
  downloadedChapters: number;
}) => Promise<void> | void;

class Semaphore {
  private tasks: Array<() => void> = [];
  private active = 0;

  constructor(private maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return;
    }
    return new Promise((resolve) => {
      this.tasks.push(resolve);
    });
  }

  release(): void {
    this.active--;
    const next = this.tasks.shift();
    if (next) {
      this.active++;
      next();
    }
  }
}

async function fetchWithRetry(url: string, retries = 3): Promise<Buffer> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        timeoutMs: 20_000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0',
          'Accept': 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://verdinha.wtf/',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

async function uploadToTelegram(
  buffer: Buffer,
  filename: string,
  settingsRepo: ISettingsRepository,
): Promise<string | null> {
  const settings = await settingsRepo.getSettings();
  const chatId = settings.telegram_chat_id ?? process.env.CAPDOWN_TELEGRAM_CHAT_ID;

  if (!chatId || !telegramBot.isConfigured()) {
    console.warn('[worker] Telegram not configured — page will not be stored in Telegram.');
    return null;
  }

  return telegramBot.sendDocument(buffer, filename, chatId);
}

export class DownloadWorker {
  private readonly semaphore = new Semaphore(3);
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    private readonly repository: IDownloadsRepository,
    private readonly settingsRepo: ISettingsRepository,
    private readonly libraryRepo: ILibraryRepository,
  ) {}

  async processJob(jobId: string, plan: DownloadPlan, onProgress?: ProgressCallback): Promise<void> {
    const abort = new AbortController();
    this.abortControllers.set(jobId, abort);

    try {
      await this.markDownloading(jobId, plan.chapters[0]?.title ?? null);

      let totalPagesDownloaded = 0;
      let totalChaptersDownloaded = 0;

      for (const chapter of plan.chapters) {
        if (abort.signal.aborted) break;

        await this.updateCurrentChapter(jobId, chapter.title);

        const adapter = getProviderAdapter(plan.sourceProviderId as ProviderId);
        if (!adapter?.getChapterPages) {
          throw new Error(`Provider "${plan.sourceProviderId}" does not support page extraction.`);
        }

        let pages: DownloadPage[];
        try {
          pages = await adapter.getChapterPages(chapter.id, chapter.sourceUrl);
        } catch (error) {
          console.error(`[worker] Failed to get pages for chapter "${chapter.title}":`, error);
          continue;
        }

        const results = await Promise.all(
          pages.map((page) => this.downloadPage(page, chapter.id, abort, jobId)),
        );

        totalPagesDownloaded += results.filter(Boolean).length;
        totalChaptersDownloaded++;

        await this.updateProgress(jobId, totalPagesDownloaded, totalChaptersDownloaded);
        await onProgress?.({ downloadedPages: totalPagesDownloaded, downloadedChapters: totalChaptersDownloaded });
      }

      if (!abort.signal.aborted) {
        await this.markCompleted(jobId);
      }
    } catch (error) {
      console.error(`[worker] Job ${jobId} failed:`, error);
      await this.markFailed(jobId, error instanceof Error ? error.message : String(error));
    } finally {
      this.abortControllers.delete(jobId);
    }
  }

  cancelJob(jobId: string): void {
    const abort = this.abortControllers.get(jobId);
    if (abort) {
      abort.abort();
      this.abortControllers.delete(jobId);
    }
  }

  private async downloadPage(
    page: DownloadPage,
    chapterId: string,
    abort: AbortController,
    jobId: string,
  ): Promise<boolean> {
    await this.semaphore.acquire();

    if (abort.signal.aborted) {
      this.semaphore.release();
      return false;
    }

    try {
      const buffer = await fetchWithRetry(page.url);
      const telegramFileId = await uploadToTelegram(buffer, page.filename, this.settingsRepo);

      if (!telegramFileId) {
        console.warn(`[worker] Skipping Telegram persist for page ${page.index} of job ${jobId}`);
        return false;
      }

      await this.libraryRepo.upsertLibraryPage(chapterId, page.index, telegramFileId);
      return true;
    } catch (error) {
      console.error(`[worker] Failed to download page ${page.url}:`, error);
      return false;
    } finally {
      this.semaphore.release();
    }
  }

  private async markDownloading(jobId: string, currentChapter: string | null): Promise<void> {
    const job = await this.repository.getDownload(jobId);
    if (!job) return;
    job.status = 'downloading';
    job.current_chapter = currentChapter;
    job.updated_at = new Date().toISOString();
    await this.repository.saveDownload(job);
  }

  private async updateCurrentChapter(jobId: string, chapter: string): Promise<void> {
    const job = await this.repository.getDownload(jobId);
    if (!job) return;
    job.current_chapter = chapter;
    job.updated_at = new Date().toISOString();
    await this.repository.saveDownload(job);
  }

  private async updateProgress(jobId: string, pages: number, chapters: number): Promise<void> {
    const job = await this.repository.getDownload(jobId);
    if (!job) return;
    job.downloaded_pages = pages;
    job.downloaded_chapters = chapters;
    await this.repository.saveDownload(job);
  }

  private async markCompleted(jobId: string): Promise<void> {
    const job = await this.repository.getDownload(jobId);
    if (!job) return;
    job.status = 'completed';
    job.error = null;
    job.updated_at = new Date().toISOString();
    await this.repository.saveDownload(job);
  }

  private async markFailed(jobId: string, message: string): Promise<void> {
    const job = await this.repository.getDownload(jobId);
    if (!job) return;
    job.status = 'failed';
    job.error = message;
    job.updated_at = new Date().toISOString();
    await this.repository.saveDownload(job);
  }
}
