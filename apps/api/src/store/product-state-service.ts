import { randomUUID } from "node:crypto";
import {
  type AppSettings,
  type AuthSession,
  type DownloadJob,
  type DownloadRequest,
  type LibraryIndex,
  type LibraryManga,
  type PrepareTelegramResponse,
  type VerifyLibraryResponse,
  type AuditMangaResponse,
  type SyncMangaResponse,
} from "@capdown/contracts";
import { AppError } from "./errors.js";
import { AppStateRepository, compareChaptersByNumber, type StoredDownloadJob } from "../repositories/app-state-repository.js";
import { previewProviderSource } from "../services/providers.js";
import { DownloadWorker } from "../services/download-worker.js";

type DownloadPlan = {
  jobId: string;
  knownSource: boolean;
  mangaId: string | null;
  mangaTitle: string | null;
  sourceProviderId: string | null;
  sourceChapterIds: string[];
  chapters: Array<{
    id: string;
    title: string;
    pageCount: number;
  }>;
  totalPages: number;
  totalChapters: number;
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

function buildDownloadError(message: string) {
  return new AppError(409, "download_source_unavailable", message);
}

export class ProductStateService {
  private readonly downloadTimers = new Map<string, { queued?: ReturnType<typeof setTimeout>; downloading?: ReturnType<typeof setTimeout> }>();
  private readonly downloadWorker: DownloadWorker;

  constructor(private readonly repository: AppStateRepository) {
    this.downloadWorker = new DownloadWorker(repository);
  }

  async init() {
    const state = await this.repository.snapshot();
    await this.backfillMissingLibraryCovers(state.library.manga);
    for (const job of state.downloads) {
      if (job.status === "queued" || job.status === "downloading") {
        await this.hydrateDownloadJob(job);
      }
    }
  }

  async getSettings() {
    const settings = await this.repository.getSettings();
    return {
      telegram_token: settings.telegram_token ?? "",
      telegram_chat_id: settings.telegram_chat_id ?? "",
    };
  }

  async saveSettings(input: AppSettings) {
    await this.repository.setSettings({
      telegram_token: input.telegram_token ?? null,
      telegram_chat_id: input.telegram_chat_id ?? null,
    });

    return { status: "ok" };
  }

  async saveAccount(input: { provider_id: string; username: string; password: string }) {
    await this.repository.upsertAuthAccount({
      provider_id: input.provider_id as never,
      username: input.username,
      password: input.password,
    });

    return { status: "ok" };
  }

  async getAuthSession(providerId: string): Promise<AuthSession> {
    return this.repository.getAuthSession(providerId);
  }

  async solveAuth(input: { provider_id: string; url: string; wait_seconds?: number }) {
    await this.repository.setAuthSession(input.provider_id, {
      connected: true,
      last_solved_at: nowIso(),
      url: input.url,
      wait_seconds: input.wait_seconds ?? null,
    });

    return { status: "ok" };
  }

  async listDownloads() {
    const jobs = await this.repository.listDownloads();
    return jobs.map(stripDownloadJob);
  }

  async getDownload(id: string) {
    const job = await this.repository.getDownload(id);
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

    await this.repository.saveDownload(createdJob);

    if (plan.knownSource) {
      this.scheduleProgression(createdJob.id, plan);
    }

    return stripDownloadJob(createdJob);
  }

  async deleteDownload(id: string) {
    const timers = this.downloadTimers.get(id);
    if (timers) {
      if (timers.queued) clearTimeout(timers.queued);
      if (timers.downloading) clearTimeout(timers.downloading);
      this.downloadTimers.delete(id);
    }
    
    this.downloadWorker.cancelJob(id);

    return this.repository.deleteDownload(id);
  }

  async listLibrary() {
    return this.repository.listLibrary();
  }

  async getManga(id: string) {
    const manga = await this.repository.getManga(id);
    if (!manga) {
      throw new AppError(404, "manga_not_found", "Manga not found");
    }

    return manga;
  }

  async deleteManga(id: string) {
    return this.repository.deleteManga(id);
  }

  async getReaderChapter(mangaId: string, chapterId: string) {
    return this.repository.getReaderChapterPayload(mangaId, chapterId);
  }

  async verifyLibrary(): Promise<VerifyLibraryResponse> {
    return this.repository.verifyLibrary();
  }

  async prepareTelegram(mangaId: string): Promise<PrepareTelegramResponse> {
    return this.repository.prepareTelegram(mangaId);
  }

  async auditManga(mangaId: string): Promise<AuditMangaResponse> {
    return this.repository.auditManga(mangaId);
  }

  async syncManga(mangaId: string): Promise<SyncMangaResponse> {
    return this.repository.syncManga(mangaId);
  }

  async getTelegramPageImage(chapterId: string, pageIndex: number) {
    return this.repository.getTelegramPageImage(chapterId, pageIndex);
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

    await this.repository.mutate((state) => {
      for (const manga of state.library.manga) {
        if (!manga.cover_url) {
          const coverUrl = coverByMangaId.get(manga.id);
          if (coverUrl) {
            manga.cover_url = coverUrl;
          }
        }
      }

      return null;
    });
  }

  private async buildDownloadPlan(input: DownloadRequest): Promise<DownloadPlan> {
    const state = await this.repository.snapshot();
    const targetUrl = normalizeUrl(input.url);

    const manga = state.library.manga.find((entry) =>
      normalizeUrl(entry.source_url) === targetUrl ||
      entry.chapters.some((chapter) => normalizeUrl(chapter.source_url) === targetUrl),
    );

    if (!manga) {
      return {
        jobId: randomUUID(),
        knownSource: false,
        mangaId: null,
        mangaTitle: null,
        sourceProviderId: null,
        sourceChapterIds: [],
        chapters: [],
        totalPages: 0,
        totalChapters: 0,
      };
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
      })),
      totalPages: selectedChapters.reduce((total, chapter) => total + chapter.pages.length, 0),
      totalChapters: selectedChapters.length,
    };
  }

  private scheduleProgression(jobId: string, plan: DownloadPlan) {
    // Substituída simulação de setTimeout pela integração do worker real
    this.downloadWorker.processJob(jobId, plan).catch(err => {
      console.error(`DownloadWorker failed for ${jobId}:`, err);
    });
  }

  private async hydrateDownloadJob(job: StoredDownloadJob) {
    if (job.status === "failed" || job.status === "completed") {
      return;
    }

    if (!job.source_manga_id) {
      await this.repository.mutate((state) => {
        const current = state.downloads.find((entry) => entry.id === job.id);
        if (!current || current.status === "failed" || current.status === "completed") {
          return null;
        }

        current.status = "failed";
        current.error = current.error ?? "download_source_unavailable: download was restored without source metadata";
        current.terminal_reason = "missing_source_metadata";
        current.updated_at = nowIso();
        return null;
      });
      return;
    }

    const state = await this.repository.snapshot();
    const manga = state.library.manga.find((entry) => entry.id === job.source_manga_id);
    if (!manga) {
      await this.repository.mutate((currentState) => {
        const current = currentState.downloads.find((entry) => entry.id === job.id);
        if (!current || current.status === "failed" || current.status === "completed") {
          return null;
        }

        current.status = "failed";
        current.error = "download_source_unavailable: source manga no longer exists in local library state";
        current.terminal_reason = "source_manga_missing";
        current.updated_at = nowIso();
        return null;
      });
      return;
    }

    const selectedChapters = job.source_chapter_ids.length > 0
      ? manga.chapters.filter((chapter) => job.source_chapter_ids.includes(chapter.id))
      : [...manga.chapters].sort(compareChaptersByNumber);

    const plan: DownloadPlan = {
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
      })),
      totalPages: selectedChapters.reduce((total, chapter) => total + chapter.pages.length, 0),
      totalChapters: selectedChapters.length,
    };

    this.scheduleProgression(job.id, plan);
  }
}
