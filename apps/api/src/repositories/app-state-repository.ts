import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AppSettings,
  type AuthSession,
  type DownloadJob,
  type LibraryChapter,
  type LibraryIndex,
  type LibraryManga,
  type ProviderId,
  type ReaderChapterPayload,
  type PrepareTelegramResponse,
  type VerifyLibraryResponse,
  type AuditMangaResponse,
  type SyncMangaResponse,
} from "@capdown/contracts";
import { AppError } from "../store/errors.js";

type StoredSettings = AppSettings & {
  updated_at: string;
};

type StoredAuthAccount = {
  provider_id: ProviderId;
  username: string;
  password: string;
  created_at: string;
  updated_at: string;
};

type StoredAuthSession = AuthSession & {
  last_solved_at: string | null;
  url: string | null;
  wait_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type StoredDownloadJob = DownloadJob & {
  chapters: string[];
  concurrency: number;
  source_manga_id: string | null;
  source_chapter_ids: string[];
  source_title: string | null;
  source_provider_id: ProviderId | string | null;
  terminal_reason: string | null;
};

type AppState = {
  settings: StoredSettings;
  auth: {
    accounts: StoredAuthAccount[];
    sessions: StoredAuthSession[];
  };
  downloads: StoredDownloadJob[];
  library: LibraryIndex;
};

type LegacyLibraryState = {
  version?: number;
  manga?: Array<{
    id?: unknown;
    provider_id?: unknown;
    source_id?: unknown;
    source_url?: unknown;
    title?: unknown;
    cover_url?: unknown;
    updated_at?: unknown;
    downloaded_at?: unknown;
    chapters?: Array<{
      id?: unknown;
      source_id?: unknown;
      title?: unknown;
      number?: unknown;
      source_url?: unknown;
      downloaded_at?: unknown;
      pages?: Array<{
        index?: unknown;
        file_path?: unknown;
      }>;
    }>;
  }>;
};

type LegacyLibraryManga = NonNullable<LegacyLibraryState["manga"]>[number];
type LegacyLibraryChapter = NonNullable<NonNullable<LegacyLibraryState["manga"]>[number]["chapters"]>[number];
type LegacyLibraryPage = NonNullable<NonNullable<LegacyLibraryChapter["pages"]>[number]>;

function clone<T>(value: T): T {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value;
}

function normalizeUrlValue(value: unknown): string {
  const raw = normalizeRequiredString(value).trim();
  if (!raw) {
    return "";
  }

  try {
    return new URL(raw).href;
  } catch {
    return raw.replace(/\/$/, "");
  }
}

function compareMaybeNumberStrings(left: string | null, right: string | null) {
  const leftNumber = left === null ? null : Number(left);
  const rightNumber = right === null ? null : Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return (leftNumber as number) - (rightNumber as number);
  }

  if (Number.isFinite(leftNumber)) {
    return -1;
  }

  if (Number.isFinite(rightNumber)) {
    return 1;
  }

  return 0;
}

function normalizeLibraryManga(raw: LegacyLibraryManga, fallbackUpdatedAt: string): LibraryManga {
  const chapters = Array.isArray(raw.chapters)
    ? raw.chapters.map((chapter: LegacyLibraryChapter, chapterIndex: number): LibraryChapter => {
        const chapterId = normalizeRequiredString(chapter.id, `chapter-${chapterIndex + 1}`);
        const chapterSourceId = normalizeRequiredString(chapter.source_id, chapterId);
        const pages = Array.isArray(chapter.pages)
          ? chapter.pages
              .map((page: LegacyLibraryPage, pageIndex: number) => ({
                index: Number(page.index ?? pageIndex + 1),
                telegram_file_id: `legacy:${chapterId}:${pageIndex + 1}`,
                telegram_message_id: null,
              }))
              .filter((page) => Number.isInteger(page.index) && page.index > 0)
          : [];

        return {
          id: chapterId,
          source_id: chapterSourceId,
          title: normalizeRequiredString(chapter.title, `Chapter ${chapterIndex + 1}`),
          number: normalizeOptionalString(chapter.number),
          source_url: normalizeUrlValue(chapter.source_url),
          page_count: pages.length,
          pages,
          downloaded_at: normalizeRequiredString(chapter.downloaded_at, fallbackUpdatedAt),
        };
      })
    : [];

  return {
    id: normalizeRequiredString(raw.id, raw.source_id ? String(raw.source_id) : `manga-${fallbackUpdatedAt}`),
    provider_id: (normalizeRequiredString(raw.provider_id, "verdinha") as ProviderId),
    media_type: "manga",
    source_id: normalizeRequiredString(raw.source_id, raw.id ? String(raw.id) : "source"),
    source_url: normalizeUrlValue(raw.source_url),
    title: normalizeRequiredString(raw.title, "Untitled manga"),
    cover_url: normalizeOptionalString(raw.cover_url),
    chapters,
    updated_at: normalizeRequiredString(raw.updated_at, normalizeRequiredString(raw.downloaded_at, fallbackUpdatedAt)),
  };
}

function normalizeState(raw: unknown): AppState {
  const fallbackNow = nowIso();

  if (typeof raw === "object" && raw !== null && "settings" in raw && "auth" in raw && "downloads" in raw && "library" in raw) {
    const typed = raw as Partial<AppState>;
    return {
      settings: {
        telegram_token: normalizeOptionalString(typed.settings?.telegram_token),
        telegram_chat_id: normalizeOptionalString(typed.settings?.telegram_chat_id),
        updated_at: normalizeRequiredString((typed.settings as StoredSettings | undefined)?.updated_at, fallbackNow),
      },
      auth: {
        accounts: Array.isArray(typed.auth?.accounts)
          ? typed.auth!.accounts.map((account) => ({
              provider_id: normalizeRequiredString(account.provider_id, "verdinha") as ProviderId,
              username: normalizeRequiredString(account.username),
              password: normalizeRequiredString(account.password),
              created_at: normalizeRequiredString(account.created_at, fallbackNow),
              updated_at: normalizeRequiredString(account.updated_at, fallbackNow),
            }))
          : [],
        sessions: Array.isArray(typed.auth?.sessions)
          ? typed.auth!.sessions.map((session) => ({
              provider_id: normalizeRequiredString(session.provider_id, "verdinha"),
              connected: Boolean(session.connected),
              last_solved_at: session.last_solved_at ?? null,
              url: session.url ?? null,
              wait_seconds: typeof session.wait_seconds === "number" ? session.wait_seconds : null,
              created_at: normalizeRequiredString(session.created_at, fallbackNow),
              updated_at: normalizeRequiredString(session.updated_at, fallbackNow),
            }))
          : [],
      },
      downloads: Array.isArray(typed.downloads)
        ? typed.downloads.map((job) => ({
            id: normalizeRequiredString(job.id, `download-${fallbackNow}`),
            url: normalizeUrlValue(job.url),
            status: job.status === "downloading" || job.status === "completed" || job.status === "failed" ? job.status : "queued",
            manga_title: job.manga_title ?? null,
            current_chapter: job.current_chapter ?? null,
            downloaded_pages: Number.isFinite(job.downloaded_pages) ? Math.max(0, Math.trunc(job.downloaded_pages)) : 0,
            total_pages: Number.isFinite(job.total_pages) ? Math.max(0, Math.trunc(job.total_pages)) : 0,
            downloaded_chapters: Number.isFinite(job.downloaded_chapters) ? Math.max(0, Math.trunc(job.downloaded_chapters)) : 0,
            total_chapters: Number.isFinite(job.total_chapters) ? Math.max(0, Math.trunc(job.total_chapters)) : 0,
            error: job.error ?? null,
            created_at: normalizeRequiredString(job.created_at, fallbackNow),
            updated_at: normalizeRequiredString(job.updated_at, fallbackNow),
            chapters: Array.isArray((job as StoredDownloadJob).chapters)
              ? (job as StoredDownloadJob).chapters.map((chapter) => String(chapter))
              : [],
            concurrency: Number.isFinite((job as StoredDownloadJob).concurrency) ? Math.max(1, Math.trunc((job as StoredDownloadJob).concurrency)) : 1,
            source_manga_id: (job as StoredDownloadJob).source_manga_id ?? null,
            source_chapter_ids: Array.isArray((job as StoredDownloadJob).source_chapter_ids)
              ? (job as StoredDownloadJob).source_chapter_ids.map((chapter) => String(chapter))
              : [],
            source_title: (job as StoredDownloadJob).source_title ?? null,
            source_provider_id: (job as StoredDownloadJob).source_provider_id ?? null,
            terminal_reason: (job as StoredDownloadJob).terminal_reason ?? null,
          }))
        : [],
      library: {
        version: Number.isInteger(typed.library?.version) ? typed.library!.version : 1,
        manga: Array.isArray(typed.library?.manga)
          ? typed.library!.manga.map((manga) => ({
              id: normalizeRequiredString(manga.id, `manga-${fallbackNow}`),
              provider_id: (normalizeRequiredString(manga.provider_id, "verdinha") as ProviderId),
              media_type: manga.media_type === "novel" ? "novel" : "manga",
              source_id: normalizeRequiredString(manga.source_id, normalizeRequiredString(manga.id, "source")),
              source_url: normalizeUrlValue(manga.source_url),
              title: normalizeRequiredString(manga.title, "Untitled manga"),
              cover_url: normalizeOptionalString(manga.cover_url),
              chapters: Array.isArray(manga.chapters)
                ? manga.chapters.map((chapter, chapterIndex) => ({
                    id: normalizeRequiredString(chapter.id, `chapter-${chapterIndex + 1}`),
                    source_id: normalizeRequiredString(chapter.source_id, `chapter-${chapterIndex + 1}`),
                    title: normalizeRequiredString(chapter.title, `Chapter ${chapterIndex + 1}`),
                    number: normalizeOptionalString(chapter.number),
                    source_url: normalizeUrlValue(chapter.source_url),
                    page_count: Number.isFinite(chapter.page_count) ? Math.max(0, Math.trunc(chapter.page_count)) : Array.isArray(chapter.pages) ? chapter.pages.length : 0,
                    pages: Array.isArray(chapter.pages)
                      ? chapter.pages.map((page, pageIndex) => ({
                          index: Number.isInteger(page.index) && page.index > 0 ? page.index : pageIndex + 1,
                          telegram_file_id: normalizeRequiredString(page.telegram_file_id, `legacy:${normalizeRequiredString(chapter.id, `chapter-${chapterIndex + 1}`)}:${pageIndex + 1}`),
                          telegram_message_id: typeof page.telegram_message_id === "number" ? page.telegram_message_id : null,
                        }))
                      : [],
                    downloaded_at: normalizeRequiredString(chapter.downloaded_at, fallbackNow),
                  }))
                : [],
              updated_at: normalizeRequiredString(manga.updated_at, fallbackNow),
            }))
          : [],
      },
    };
  }

  if (typeof raw === "object" && raw !== null && "manga" in raw) {
    const legacy = raw as LegacyLibraryState;
    return {
      settings: {
        telegram_token: null,
        telegram_chat_id: null,
        updated_at: fallbackNow,
      },
      auth: {
        accounts: [],
        sessions: [],
      },
      downloads: [],
      library: {
        version: typeof legacy.version === "number" && Number.isInteger(legacy.version) ? legacy.version : 1,
        manga: Array.isArray(legacy.manga) ? legacy.manga.map((manga: LegacyLibraryManga) => normalizeLibraryManga(manga, fallbackNow)) : [],
      },
    };
  }

  return {
    settings: {
      telegram_token: null,
      telegram_chat_id: null,
      updated_at: fallbackNow,
    },
    auth: {
      accounts: [],
      sessions: [],
    },
    downloads: [],
    library: {
      version: 1,
      manga: [],
    },
  };
}

function sortChapters(chapters: LibraryChapter[]) {
  return [...chapters].sort((left, right) => {
    const leftNumber = left.number === null ? null : Number(left.number);
    const rightNumber = right.number === null ? null : Number(right.number);
    const numericComparison = compareMaybeNumberStrings(Number.isFinite(leftNumber) ? String(leftNumber) : null, Number.isFinite(rightNumber) ? String(rightNumber) : null);

    if (numericComparison !== 0) {
      return numericComparison;
    }

    const titleComparison = left.title.localeCompare(right.title, "pt-BR", { numeric: true, sensitivity: "base" });
    if (titleComparison !== 0) {
      return titleComparison;
    }

    return left.source_id.localeCompare(right.source_id, "pt-BR", { numeric: true, sensitivity: "base" });
  });
}

export class AppStateRepository {
  private readonly statePath = resolve(fileURLToPath(new URL("../../data/app-state.json", import.meta.url)));
  private readonly legacySeedPath = resolve(fileURLToPath(new URL("../../../../library/index.json.bak", import.meta.url)));
  private cache: AppState | null = null;
  private readonly queue = { promise: Promise.resolve() };

  private async loadFromDisk(): Promise<AppState> {
    try {
      const raw = await readFile(this.statePath, "utf8");
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        throw error;
      }
    }

    try {
      const raw = await readFile(this.legacySeedPath, "utf8");
      const seededState = normalizeState(JSON.parse(raw));
      await this.persist(seededState);
      return seededState;
    } catch {
      const fallback = normalizeState(null);
      await this.persist(fallback);
      return fallback;
    }
  }

  private async ensureLoaded(): Promise<AppState> {
    if (this.cache) {
      return this.cache;
    }

    this.cache = await this.loadFromDisk();
    return this.cache;
  }

  private async persist(state: AppState) {
    await mkdir(dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async snapshot(): Promise<AppState> {
    await this.queue.promise;
    return clone(await this.ensureLoaded());
  }

  async mutate<T>(mutator: (state: AppState) => T | Promise<T>): Promise<T> {
    const run = this.queue.promise.then(async () => {
      const state = await this.ensureLoaded();
      const result = await mutator(state);
      await this.persist(state);
      return result;
    });

    this.queue.promise = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  async replaceLibrary(nextLibrary: LibraryIndex) {
    return this.mutate((state) => {
      state.library = nextLibrary;
      return state.library;
    });
  }

  async getSettings() {
    const state = await this.snapshot();
    return state.settings;
  }

  async setSettings(nextSettings: Partial<AppSettings>) {
    return this.mutate((state) => {
      state.settings = {
        telegram_token: nextSettings.telegram_token ?? state.settings.telegram_token ?? null,
        telegram_chat_id: nextSettings.telegram_chat_id ?? state.settings.telegram_chat_id ?? null,
        updated_at: nowIso(),
      };

      return state.settings;
    });
  }

  async listAuthAccounts() {
    const state = await this.snapshot();
    return state.auth.accounts;
  }

  async upsertAuthAccount(account: { provider_id: ProviderId; username: string; password: string }) {
    return this.mutate((state) => {
      const existing = state.auth.accounts.find(
        (entry) => entry.provider_id === account.provider_id && entry.username === account.username,
      );
      if (existing) {
        existing.password = account.password;
        existing.updated_at = nowIso();
        return existing;
      }

      const created = {
        provider_id: account.provider_id,
        username: account.username,
        password: account.password,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      state.auth.accounts.push(created);
      return created;
    });
  }

  async getAuthSession(providerId: string): Promise<AuthSession> {
    const state = await this.snapshot();
    const session = state.auth.sessions.find((entry) => entry.provider_id === providerId);
    return {
      provider_id: providerId,
      connected: session?.connected ?? false,
    };
  }

  async setAuthSession(providerId: string, next: Partial<StoredAuthSession>) {
    return this.mutate((state) => {
      const existing = state.auth.sessions.find((entry) => entry.provider_id === providerId);
      if (existing) {
        existing.connected = next.connected ?? existing.connected;
        existing.last_solved_at = next.last_solved_at ?? existing.last_solved_at;
        existing.url = next.url ?? existing.url;
        existing.wait_seconds = next.wait_seconds ?? existing.wait_seconds;
        existing.updated_at = nowIso();
        return existing;
      }

      const created: StoredAuthSession = {
        provider_id: providerId,
        connected: next.connected ?? false,
        last_solved_at: next.last_solved_at ?? null,
        url: next.url ?? null,
        wait_seconds: next.wait_seconds ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };

      state.auth.sessions.push(created);
      return created;
    });
  }

  async listDownloads() {
    const state = await this.snapshot();
    return state.downloads;
  }

  async getDownload(id: string) {
    const state = await this.snapshot();
    return state.downloads.find((job) => job.id === id) ?? null;
  }

  async saveDownload(job: StoredDownloadJob) {
    return this.mutate((state) => {
      const existingIndex = state.downloads.findIndex((entry) => entry.id === job.id);
      if (existingIndex >= 0) {
        state.downloads[existingIndex] = job;
      } else {
        state.downloads.unshift(job);
      }
      return job;
    });
  }

  async deleteDownload(id: string) {
    return this.mutate((state) => {
      const index = state.downloads.findIndex((job) => job.id === id);
      if (index < 0) {
        throw new AppError(404, "download_not_found", "Download job not found");
      }

      state.downloads.splice(index, 1);
      return { status: "ok" };
    });
  }

  async listLibrary() {
    const state = await this.snapshot();
    return state.library;
  }

  async getManga(id: string) {
    const state = await this.snapshot();
    return state.library.manga.find((manga) => manga.id === id) ?? null;
  }

  async upsertManga(manga: LibraryManga) {
    return this.mutate((state) => {
      const index = state.library.manga.findIndex((entry) => entry.id === manga.id);
      if (index >= 0) {
        state.library.manga[index] = manga;
      } else {
        state.library.manga.push(manga);
      }
      state.library.manga.sort((left, right) => left.title.localeCompare(right.title, "pt-BR", { numeric: true, sensitivity: "base" }));
      return manga;
    });
  }

  async deleteManga(id: string) {
    return this.mutate((state) => {
      const index = state.library.manga.findIndex((entry) => entry.id === id);
      if (index < 0) {
        throw new AppError(404, "manga_not_found", "Manga not found");
      }

      state.library.manga.splice(index, 1);
      return { status: "ok" };
    });
  }

  async findChapter(chapterId: string) {
    const state = await this.snapshot();
    for (const manga of state.library.manga) {
      const chapter = manga.chapters.find((entry) => entry.id === chapterId);
      if (chapter) {
        return { manga, chapter };
      }
    }

    return null;
  }

  async getReaderChapterPayload(mangaId: string, chapterId: string): Promise<ReaderChapterPayload> {
    const state = await this.snapshot();
    const manga = state.library.manga.find((entry) => entry.id === mangaId);
    if (!manga) {
      throw new AppError(404, "manga_not_found", "Manga not found");
    }

    const chapters = sortChapters(manga.chapters);
    const chapterIndex = chapters.findIndex((entry) => entry.id === chapterId);
    if (chapterIndex < 0) {
      throw new AppError(404, "chapter_not_found", "Chapter not found");
    }

    const chapter = chapters[chapterIndex];
    return {
      manga_id: manga.id,
      manga_title: manga.title,
      chapter,
      pages: chapter.pages,
      prev_chapter: chapterIndex > 0
        ? {
            id: chapters[chapterIndex - 1].id,
            title: chapters[chapterIndex - 1].title,
            number: chapters[chapterIndex - 1].number,
          }
        : null,
      next_chapter: chapterIndex < chapters.length - 1
        ? {
            id: chapters[chapterIndex + 1].id,
            title: chapters[chapterIndex + 1].title,
            number: chapters[chapterIndex + 1].number,
          }
        : null,
    };
  }

  async verifyLibrary(): Promise<VerifyLibraryResponse> {
    const state = await this.snapshot();
    const reports = state.library.manga.flatMap((manga) =>
      manga.chapters.flatMap((chapter) => {
        const telegramPages = chapter.pages.filter((page) => page.telegram_message_id !== null).length;
        const issues: VerifyLibraryResponse["reports"] = [];

        if (chapter.page_count !== chapter.pages.length) {
          issues.push({
            manga_title: manga.title,
            chapter_title: chapter.title,
            chapter_id: chapter.id,
            issue: "pages_missing",
            expected_pages: chapter.page_count,
            telegram_pages: telegramPages,
          });
        }

        if (chapter.pages.length > 0 && telegramPages < chapter.pages.length) {
          issues.push({
            manga_title: manga.title,
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
    const state = await this.snapshot();
    const manga = state.library.manga.find((entry) => entry.id === mangaId);
    if (!manga) {
      throw new AppError(404, "manga_not_found", "Manga not found");
    }

    const discrepancies = manga.chapters.flatMap((chapter) => {
      const telegramPages = chapter.pages.filter((page) => page.telegram_message_id !== null).length;
      const chapterIssues: AuditMangaResponse["discrepancies"] = [];

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
    return this.mutate((state) => {
      const manga = state.library.manga.find((entry) => entry.id === mangaId);
      if (!manga) {
        throw new AppError(404, "manga_not_found", "Manga not found");
      }

      let uploadedPages = 0;

      manga.chapters.forEach((chapter, chapterIndex) => {
        chapter.pages.forEach((page, pageIndex) => {
          if (page.telegram_message_id === null) {
            page.telegram_message_id = chapterIndex * 1000 + pageIndex + 1;
            uploadedPages += 1;
          }
        });
      });

      manga.updated_at = nowIso();

      return {
        status: "ok",
        uploaded_pages: uploadedPages,
        failed_pages: [],
      };
    });
  }

  async syncManga(mangaId: string): Promise<SyncMangaResponse> {
    const state = await this.snapshot();
    const manga = state.library.manga.find((entry) => entry.id === mangaId);
    if (!manga) {
      throw new AppError(404, "manga_not_found", "Manga not found");
    }

    return {
      status: "ok",
      count: 0,
      imported: [],
    };
  }

  async getTelegramPageImage(chapterId: string, pageIndex: number) {
    const chapterData = await this.findChapter(chapterId);
    if (!chapterData) {
      throw new AppError(404, "page_not_found", "Page not found");
    }

    const page = chapterData.chapter.pages.find((entry) => entry.index === pageIndex);
    if (!page) {
      throw new AppError(404, "page_not_found", "Page not found");
    }

    const svg = this.buildPageSvg({
      mangaTitle: chapterData.manga.title,
      chapterTitle: chapterData.chapter.title,
      chapterNumber: chapterData.chapter.number,
      pageIndex,
      pageCount: chapterData.chapter.pages.length,
      telegramMessageId: page.telegram_message_id,
      prepared: page.telegram_message_id !== null,
    });

    return {
      contentType: "image/svg+xml; charset=utf-8",
      body: svg,
    };
  }

  private buildPageSvg(input: {
    mangaTitle: string;
    chapterTitle: string;
    chapterNumber: string | null;
    pageIndex: number;
    pageCount: number;
    telegramMessageId: number | null;
    prepared: boolean;
  }) {
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
}

export function compareChaptersByNumber(left: LibraryChapter, right: LibraryChapter) {
  const leftNumber = left.number === null ? null : Number(left.number);
  const rightNumber = right.number === null ? null : Number(right.number);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return (leftNumber as number) - (rightNumber as number);
  }

  if (Number.isFinite(leftNumber)) {
    return -1;
  }

  if (Number.isFinite(rightNumber)) {
    return 1;
  }

  const titleComparison = left.title.localeCompare(right.title, "pt-BR", { numeric: true, sensitivity: "base" });
  if (titleComparison !== 0) {
    return titleComparison;
  }

  return left.source_id.localeCompare(right.source_id, "pt-BR", { numeric: true, sensitivity: "base" });
}
