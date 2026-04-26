import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { verdinhaAdapter } from '../providers/verdinha.js';
import type { AppStateRepository } from '../repositories/app-state-repository.js';

// Simple semaphore for concurrency control
class Semaphore {
  private tasks: Array<() => void> = [];
  private active = 0;

  constructor(private maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.tasks.push(resolve);
    });
  }

  release(): void {
    this.active--;
    if (this.tasks.length > 0) {
      this.active++;
      const next = this.tasks.shift();
      if (next) next();
    }
  }
}

async function fetchWithRetry(url: string, retries = 3): Promise<Buffer> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      // NOTE: For cdn.verdinha.wtf we MUST NOT send the Authorization header.
      const response = await fetch(url, {
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

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      attempt++;
      if (attempt >= retries) throw error;
      // Exponential backoff: 1s, 2s, 4s...
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error('Unreachable');
}

export class DownloadWorker {
  private semaphore = new Semaphore(3); // Max 3 concurrent CDN requests
  private abortControllers = new Map<string, AbortController>();

  constructor(private readonly repository: AppStateRepository) {}

  async processJob(jobId: string, plan: any) {
    const abort = new AbortController();
    this.abortControllers.set(jobId, abort);

    try {
      // Update job to downloading
      await this.repository.mutate((state) => {
        const job = state.downloads.find((entry) => entry.id === jobId);
        if (job) {
          job.status = 'downloading';
          job.current_chapter = plan.chapters[0]?.title ?? null;
          job.updated_at = new Date().toISOString();
        }
        return null;
      });

      let totalPagesDownloaded = 0;
      let totalChaptersDownloaded = 0;

      for (const chapter of plan.chapters) {
        if (abort.signal.aborted) break;

        await this.repository.mutate((state) => {
          const job = state.downloads.find((entry) => entry.id === jobId);
          if (job) {
            job.current_chapter = chapter.title;
            job.updated_at = new Date().toISOString();
          }
          return null;
        });

        // 1. Fetch the chapter pages from the provider (Verdinha specific for now)
        let pages;
        try {
          if (plan.sourceProviderId === 'verdinha') {
            pages = await verdinhaAdapter.getChapterPages!(chapter.id);
          } else {
            // Stub for other providers
            pages = [];
          }
        } catch (error) {
          console.error(`Failed to get chapter pages for ${chapter.title}:`, error);
          continue; // Skip chapter on failure to list pages
        }

        // 2. Download each page with concurrency limit
        const pagePromises = pages.map(async (page) => {
          await this.semaphore.acquire();
          if (abort.signal.aborted) {
            this.semaphore.release();
            return false;
          }

          try {
            const buffer = await fetchWithRetry(page.url);

            // 3. Save to local library directory (Mocking Telegram-first persistence for now)
            const libraryDir = join(process.cwd(), 'library', plan.mangaId, 'capitulos', chapter.title.replace(/[^a-z0-9]/gi, '_'));
            await mkdir(libraryDir, { recursive: true });
            await writeFile(join(libraryDir, page.filename), buffer);

            // Increment page progress
            totalPagesDownloaded++;
            await this.repository.mutate((state) => {
              const job = state.downloads.find((entry) => entry.id === jobId);
              if (job) {
                job.downloaded_pages = totalPagesDownloaded;
              }
              return null;
            });
            return true;
          } catch (error) {
            console.error(`Failed to download page ${page.url}:`, error);
            return false;
          } finally {
            this.semaphore.release();
          }
        });

        await Promise.all(pagePromises);
        totalChaptersDownloaded++;
        
        await this.repository.mutate((state) => {
          const job = state.downloads.find((entry) => entry.id === jobId);
          if (job) {
            job.downloaded_chapters = totalChaptersDownloaded;
          }
          return null;
        });
      }

      if (!abort.signal.aborted) {
        await this.repository.mutate((state) => {
          const job = state.downloads.find((entry) => entry.id === jobId);
          if (job) {
            job.status = 'completed';
            job.error = null;
            job.updated_at = new Date().toISOString();
          }
          return null;
        });
      }
    } catch (error) {
      console.error(`Download job ${jobId} failed:`, error);
      await this.repository.mutate((state) => {
        const job = state.downloads.find((entry) => entry.id === jobId);
        if (job) {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : String(error);
          job.updated_at = new Date().toISOString();
        }
        return null;
      });
    } finally {
      this.abortControllers.delete(jobId);
    }
  }

  cancelJob(jobId: string) {
    const abort = this.abortControllers.get(jobId);
    if (abort) {
      abort.abort();
      this.abortControllers.delete(jobId);
    }
  }
}
