import { randomUUID } from "node:crypto";
import {
  type AppSettings,
  type AuthSession,
  type DownloadJob,
  type DownloadRequest,
  type LibraryManga,
  type PrepareTelegramResponse,
  type VerifyLibraryResponse,
  type AuditMangaResponse,
  type SyncMangaResponse,
} from "@capdown/contracts";
import { AppError } from "./errors.js";

import type { IAuthRepository, IDownloadsRepository, ILibraryRepository, ISettingsRepository, StoredDownloadJob } from "../repositories/interfaces.js";
import { previewProviderSource } from "../services/providers.js";
import type { DownloadPlan } from "../services/download-worker.js";
import { DownloadQueue } from "../queues/download-queue.js";
import { logger } from '../utils/logger.js';

type InternalDownloadPlan = DownloadPlan & {
  knownSource: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeUrl(value: string) {
  try {
    return new URL(value).href;
  } catch {
    return value.trim();
  }
}

function stripDownloadJob(job: StoredDownloadJob): DownloadJob {
  const { chapters, concurrency, source_manga_id, source_chapter_ids, source_title, source_provider_id, terminal_reason, ...publicJob } = job;
  return publicJob;
}

type LibraryChapter = LibraryManga['chapters'][number];

function compareChaptersByNumber(left: LibraryChapter, right: LibraryChapter): number {
  const l = left.number === null ? null : Number(left.number);
  const r = right.number === null ? null : Number(right.number);

  if (Number.isFinite(l) && Number.isFinite(r) && l !== r) return (l as number) - (r as number);
  if (Number.isFinite(l)) return -1;
  if (Number.isFinite(r)) return 1;

  const byTitle = left.title.localeCompare(right.title, 'pt-BR', { numeric: true, sensitivity: 'base' });
  if (byTitle !== 0) return byTitle;

  return left.source_id.localeCompare(right.source_id, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export class ProductStateService {
  private readonly downloadQueue: DownloadQueue;

  constructor(
    private readonly settingsRepo: ISettingsRepository,
    private readonly authRepo: IAuthRepository,
    private readonly libraryRepo: ILibraryRepository,
    private readonly downloadsRepo: IDownloadsRepository,
  ) {
    this.downloadQueue = new DownloadQueue(downloadsRepo, settingsRepo, libraryRepo);
  }

  async init(): Promise<void> {
    await this.downloadQueue.start();

    const downloads = await this.downloadsRepo.listDownloads();
    for (const job of downloads) {
      if (job.status === 'queued' || job.status === 'downloading') {
        await this.hydrateDownloadJob(job);
      }
    }
  }

  /** Manually trigger cover backfill — call via POST /api/library/backfill-covers */
  async backfillCovers(): Promise<{ backfilled: number }> {
    const library = await this.libraryRepo.listLibrary();
    const before = library.manga.filter(m => !m.cover_url && m.source_url).length;
    await this.backfillMissingLibraryCovers(library.manga);
    return { backfilled: before };
  }

  async getSettings() {
    const settings = await this.settingsRepo.getSettings();
    return {
      telegram_token: settings.telegram_token ?? "",
      telegram_chat_id: settings.telegram_chat_id ?? "",
      enabled_providers: settings.enabled_providers ?? [],
    };
  }

  async saveSettings(input: AppSettings) {
    await this.settingsRepo.setSettings({
      telegram_token: input.telegram_token ?? null,
      telegram_chat_id: input.telegram_chat_id ?? null,
      enabled_providers: input.enabled_providers,
    });

    return { status: "ok" };
  }

  async saveAccount(input: { provider_id: string; username: string; password: string }) {
    await this.authRepo.upsertAuthAccount({
      provider_id: input.provider_id as ProviderId,
      username: input.username,
      password: input.password,
    });
    return { status: 'ok' };
  }

  async getAuthSession(providerId: string): Promise<AuthSession> {
    return this.authRepo.getAuthSession(providerId);
  }

  async solveAuth(input: { provider_id: string; url: string; wait_seconds?: number }) {
    await this.authRepo.setAuthSession(input.provider_id, {
      connected: true,
      last_solved_at: nowIso(),
      url: input.url,
      wait_seconds: input.wait_seconds,
    });

    return { status: "ok" };
  }

  async listDownloads() {
    const jobs = await this.downloadsRepo.listDownloads();
    return jobs.map(stripDownloadJob);
  }

  async getDownload(id: string) {
    const job = await this.downloadsRepo.getDownload(id);
    if (!job) {
      throw new AppError(404, "download_not_found", "Download job not found");
    }

    return stripDownloadJob(job);
  }

  async createDownload(input: DownloadRequest) {
    const plan = await this.buildDownloadPlan(input);
    const createdJob: StoredDownloadJob = {
      id: plan.jobId,
      url: normalizeUrl(input.url),
      status: plan.knownSource ? "queued" : "failed",
      manga_title: plan.mangaTitle,
      current_chapter: plan.chapters[0]?.title ?? null,
      downloaded_pages: 0,
      total_pages: plan.totalPages,
      downloaded_chapters: 0,
      total_chapters: plan.totalChapters,
      error: plan.knownSource ? null : "download_source_unavailable: source URL not found in local library state",
      created_at: nowIso(),
      updated_at: nowIso(),
      chapters: plan.sourceChapterIds,
      concurrency: input.concurrency ?? 1,
      source_manga_id: plan.mangaId,
      source_chapter_ids: plan.sourceChapterIds,
      source_title: plan.mangaTitle,
      source_provider_id: plan.sourceProviderId,
      terminal_reason: plan.knownSource ? null : "source_not_found",
    };

    await this.downloadsRepo.saveDownload(createdJob);

    if (plan.knownSource) {
      this.scheduleProgression(createdJob.id, plan);
    }

    return stripDownloadJob(createdJob);
  }

  async deleteDownload(id: string) {
    await this.downloadQueue.remove(id);
    return this.downloadsRepo.deleteDownload(id);
  }

  async listLibrary() {
    return this.libraryRepo.listLibrary();
  }

  async getManga(id: string) {
    const manga = await this.libraryRepo.getManga(id);
    if (!manga) {
      throw new AppError(404, "manga_not_found", "Manga not found");
    }

    return manga;
  }

  async deleteManga(id: string) {
    return this.libraryRepo.deleteManga(id);
  }

  async getReaderChapter(mangaId: string, chapterId: string) {
    return this.libraryRepo.getReaderChapterPayload(mangaId, chapterId);
  }

  async verifyLibrary(): Promise<VerifyLibraryResponse> {
    return this.libraryRepo.verifyLibrary();
  }

  async prepareTelegram(mangaId: string): Promise<PrepareTelegramResponse> {
    return this.libraryRepo.prepareTelegram(mangaId);
  }

  async auditManga(mangaId: string): Promise<AuditMangaResponse> {
    return this.libraryRepo.auditManga(mangaId);
  }

  async syncManga(mangaId: string): Promise<SyncMangaResponse> {
    return this.libraryRepo.syncManga(mangaId);
  }

  async getTelegramPageImage(chapterId: string, pageIndex: number) {
    return this.libraryRepo.getTelegramPageImage(chapterId, pageIndex);
  }

  private async backfillMissingLibraryCovers(mangaList: LibraryManga[]) {
    const candidates = mangaList.filter((manga) => !manga.cover_url && manga.source_url);
    if (candidates.length === 0) {
      return;
    }

    const coverByMangaId = new Map<string, string>();
    const results = await Promise.allSettled(
      candidates.map(async (manga) => {
        const preview = await previewProviderSource(manga.source_url);
        if (!preview.cover_url) {
          return null;
        }

        return { mangaId: manga.id, coverUrl: preview.cover_url };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        coverByMangaId.set(result.value.mangaId, result.value.coverUrl);
      }
    }

    if (coverByMangaId.size === 0) {
      return;
    }

    for (const [mangaId, coverUrl] of coverByMangaId.entries()) {
      const manga = await this.libraryRepo.getManga(mangaId);
      if (manga && !manga.cover_url) {
        manga.cover_url = coverUrl;
        await this.libraryRepo.upsertManga(manga);
      }
    }
  }

  private async buildDownloadPlan(input: DownloadRequest): Promise<InternalDownloadPlan> {
    const library = await this.libraryRepo.listLibrary();
    const targetUrl = normalizeUrl(input.url);

    const manga = library.manga.find((entry) =>
      normalizeUrl(entry.source_url) === targetUrl ||
      entry.chapters.some((chapter) => normalizeUrl(chapter.source_url) === targetUrl),
    );

    if (!manga) {
      return {
        jobId: randomUUID(),
        knownSource: false,
        mangaId: '',
        mangaTitle: null,
        sourceProviderId: null,
        sourceChapterIds: [],
        chapters: [],
        totalPages: 0,
        totalChapters: 0,
      } as InternalDownloadPlan;
    }

    const sortedChapters = [...manga.chapters].sort(compareChaptersByNumber);
    const selectedChapters = input.chapters?.length
      ? sortedChapters.filter((chapter) => input.chapters?.includes(chapter.source_id) || input.chapters?.includes(chapter.id))
      : sortedChapters;

    if (input.chapters?.length && selectedChapters.length === 0) {
      throw new AppError(404, "download_chapters_not_found", "The requested chapters were not found in the local library state");
    }

    if (selectedChapters.length === 0) {
      throw new AppError(409, "download_source_empty", "The selected source does not contain chapters in the local library state");
    }

    return {
      jobId: randomUUID(),
      knownSource: true,
      mangaId: manga.id,
      mangaTitle: manga.title,
      sourceProviderId: manga.provider_id,
      sourceChapterIds: selectedChapters.map((chapter) => chapter.id),
      chapters: selectedChapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        pageCount: chapter.pages.length,
        sourceUrl: chapter.source_url,
      })),
      totalPages: selectedChapters.reduce((total, chapter) => total + chapter.pages.length, 0),
      totalChapters: selectedChapters.length,
    } as InternalDownloadPlan;
  }

  private scheduleProgression(_jobId: string, plan: InternalDownloadPlan): void {
    void this.downloadQueue.enqueue(plan).catch((err) =>
      logger.error('[service] Failed to enqueue download:', err),
    );
  }

  private async hydrateDownloadJob(job: StoredDownloadJob) {
    if (job.status === "failed" || job.status === "completed") {
      return;
    }

    if (!job.source_manga_id) {
      job.status = "failed";
      job.error = job.error ?? "download_source_unavailable: download was restored without source metadata";
      job.terminal_reason = "missing_source_metadata";
      job.updated_at = nowIso();
      await this.downloadsRepo.saveDownload(job);
      return;
    }

    const manga = await this.libraryRepo.getManga(job.source_manga_id);
    if (!manga) {
      job.status = "failed";
      job.error = "download_source_unavailable: source manga no longer exists in local library state";
      job.terminal_reason = "source_manga_missing";
      job.updated_at = nowIso();
      await this.downloadsRepo.saveDownload(job);
      return;
    }

    const selectedChapters = job.source_chapter_ids.length > 0
      ? manga.chapters.filter((chapter) => job.source_chapter_ids.includes(chapter.id))
      : [...manga.chapters].sort(compareChaptersByNumber);

    const plan: InternalDownloadPlan = {
      jobId: job.id,
      knownSource: true,
      mangaId: manga.id,
      mangaTitle: manga.title,
      sourceProviderId: manga.provider_id,
      sourceChapterIds: selectedChapters.map((chapter) => chapter.id),
      chapters: selectedChapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        pageCount: chapter.pages.length,
        sourceUrl: chapter.source_url,
      })),
      totalPages: selectedChapters.reduce((total, chapter) => total + chapter.pages.length, 0),
      totalChapters: selectedChapters.length,
    } as InternalDownloadPlan;

    this.scheduleProgression(job.id, plan);
  }
}
