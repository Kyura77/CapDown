import {
  type AppSettings,
  type AuthSession,
  type ProviderId,
  type DownloadJob,
  type LibraryIndex,
  type LibraryManga,
  type ReaderChapterPayload,
  type VerifyLibraryResponse,
  type AuditMangaResponse,
  type PrepareTelegramResponse,
  type SyncMangaResponse,
} from "@capdown/contracts";

export interface ISettingsRepository {
  getSettings(): Promise<AppSettings & { updated_at?: string }>;
  setSettings(settings: Partial<AppSettings>): Promise<AppSettings & { updated_at?: string }>;
}

export interface IAuthRepository {
  listAuthAccounts(): Promise<Array<{ provider_id: ProviderId; username: string; password?: string; created_at: string; updated_at: string }>>;
  upsertAuthAccount(account: { provider_id: ProviderId; username: string; password: string }): Promise<any>;
  getAuthSession(providerId: string): Promise<AuthSession>;
  setAuthSession(providerId: string, session: Partial<AuthSession & { url?: string; wait_seconds?: number; last_solved_at?: string }>): Promise<any>;
}

export type StoredDownloadJob = DownloadJob & {
  chapters: string[];
  concurrency: number;
  source_manga_id: string | null;
  source_chapter_ids: string[];
  source_title: string | null;
  source_provider_id: string | null;
  terminal_reason: string | null;
};

export interface IDownloadsRepository {
  listDownloads(): Promise<StoredDownloadJob[]>;
  getDownload(id: string): Promise<StoredDownloadJob | null>;
  saveDownload(job: StoredDownloadJob): Promise<StoredDownloadJob>;
  deleteDownload(id: string): Promise<{ status: string }>;
}

export interface ILibraryRepository {
  listLibrary(): Promise<LibraryIndex>;
  getManga(id: string): Promise<LibraryManga | null>;
  upsertManga(manga: LibraryManga): Promise<LibraryManga>;
  deleteManga(id: string): Promise<{ status: string }>;
  getReaderChapterPayload(mangaId: string, chapterId: string): Promise<ReaderChapterPayload>;
  verifyLibrary(): Promise<VerifyLibraryResponse>;
  auditManga(mangaId: string): Promise<AuditMangaResponse>;
  prepareTelegram(mangaId: string): Promise<PrepareTelegramResponse>;
  syncManga(mangaId: string): Promise<SyncMangaResponse>;
  getTelegramPageImage(chapterId: string, pageIndex: number): Promise<{ contentType: string; body: string | Buffer }>;
  upsertLibraryPage(chapterId: string, pageIndex: number, telegramFileId: string): Promise<void>;
}
