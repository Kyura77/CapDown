import { z } from 'zod';

export const providerIdSchema = z.enum([
  'verdinha',
  'manga_dex',
  'comick',
  'flower_mangas',
  'arthur_scan',
  'capitoons',
  'ego_toons',
  'geass_comics',
  'hanami_heaven',
  'hiper_cool',
  'hunters_scans',
  'mediocre_toons',
  'nexus_toons',
  'tia_manhwa',
  'yomu_comics',
  'blackout_comics',
  'saikai_scan',
  'astra_toons',
  'manga_fire',
]);

export const scrapeModeSchema = z.enum(['manga', 'chapter', 'search']);

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string().min(1),
  runtime: z.string().min(1),
});

export const scrapeRequestSchema = z.object({
  provider: z.string().min(1),
  url: z.string().url(),
  mode: scrapeModeSchema,
});

export const scrapeResponseSchema = z.object({
  status: z.string().min(1),
  provider: z.string().min(1),
  url: z.string().url(),
  mode: scrapeModeSchema,
});

export const providerInfoSchema = z.object({
  id: providerIdSchema,
  name: z.string().min(1),
  domains: z.array(z.string().min(1)),
});

export const providersResponseSchema = z.array(providerInfoSchema);

export const searchParamsSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
  deep: z.preprocess((value) => {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") {
        return true;
      }

      if (normalized === "false" || normalized === "0") {
        return false;
      }
    }

    return value;
  }, z.boolean()).optional(),
  providers: z.string().min(1).optional(),
});

export const searchResultSourceSchema = z.object({
  provider_id: providerIdSchema,
  source_id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string(),
  source_url: z.string().url(),
  cover_url: z.string().url().nullable(),
  total_chapters: z.number().int().nonnegative().nullable(),
  description: z.string().nullable(),
});

export const unifiedSearchResultSchema = z.object({
  title: z.string().min(1),
  cover_url: z.string().url().nullable(),
  description: z.string().nullable(),
  sources: z.array(searchResultSourceSchema),
  score: z.number(),
});

export const searchResponseSchema = z.array(unifiedSearchResultSchema);

export const aiSearchAnalysisSchema = z.object({
  interpretation: z.string().min(1),
  search_terms: z.array(z.string().min(1)),
  tags: z.array(z.string().min(1)),
  ai_powered: z.boolean(),
});

export const aiSearchResponseSchema = z.object({
  analysis: aiSearchAnalysisSchema,
  results: searchResponseSchema,
});

export const previewRequestSchema = z.object({
  url: z.string().url(),
});

export const sourceChapterSchema = z.object({
  source_id: z.string().min(1),
  title: z.string().min(1),
  number: z.string().nullable(),
  source_url: z.string().url(),
});

export const previewResponseSchema = z.object({
  provider_id: providerIdSchema,
  source_id: z.string().min(1),
  title: z.string().min(1),
  source_url: z.string().url(),
  cover_url: z.string().url().nullable(),
  chapters: z.array(sourceChapterSchema),
});

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export const statusResponseSchema = z.object({
  status: z.string().min(1),
});

export const downloadRequestSchema = z.object({
  url: z.string().url(),
  chapters: z.array(z.string().min(1)).optional(),
  concurrency: z.coerce.number().int().positive().optional(),
});

export const downloadStatusSchema = z.enum(['queued', 'downloading', 'completed', 'failed']);

export const downloadJobSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  status: downloadStatusSchema,
  manga_title: z.string().nullable(),
  current_chapter: z.string().nullable(),
  downloaded_pages: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
  downloaded_chapters: z.number().int().nonnegative(),
  total_chapters: z.number().int().nonnegative(),
  error: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export const downloadsResponseSchema = z.array(downloadJobSchema);

export const libraryPageSchema = z.object({
  index: z.number().int().positive(),
  telegram_file_id: z.string().min(1),
  telegram_message_id: z.number().int().nullable(),
});

export const libraryChapterSchema = z.object({
  id: z.string().min(1),
  source_id: z.string().min(1),
  title: z.string().min(1),
  number: z.string().nullable(),
  source_url: z.string().min(1),
  page_count: z.number().int().nonnegative(),
  pages: z.array(libraryPageSchema),
  downloaded_at: z.string().min(1),
});

export const libraryMangaSchema = z.object({
  id: z.string().min(1),
  provider_id: providerIdSchema,
  media_type: z.enum(['manga', 'novel']).default('manga'),
  source_id: z.string().min(1),
  source_url: z.string().min(1),
  title: z.string().min(1),
  cover_url: z.string().nullable(),
  chapters: z.array(libraryChapterSchema),
  updated_at: z.string().min(1),
});

export const libraryIndexSchema = z.object({
  version: z.number().int().positive(),
  manga: z.array(libraryMangaSchema),
});

export const readerChapterNavSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  number: z.string().nullable(),
});

export const readerChapterPayloadSchema = z.object({
  manga_id: z.string().min(1),
  manga_title: z.string().min(1),
  chapter: libraryChapterSchema,
  pages: z.array(libraryPageSchema),
  prev_chapter: readerChapterNavSchema.nullable(),
  next_chapter: readerChapterNavSchema.nullable(),
});

export const appSettingsSchema = z.object({
  telegram_token: z.string().nullable().optional(),
  telegram_chat_id: z.string().nullable().optional(),
});

export const authSessionSchema = z.object({
  provider_id: z.string().min(1),
  connected: z.boolean(),
});

export const solveAuthRequestSchema = z.object({
  provider_id: z.string().min(1),
  url: z.string().url(),
  wait_seconds: z.coerce.number().int().positive().optional(),
});

export const accountRequestSchema = z.object({
  provider_id: providerIdSchema,
  username: z.string().min(1),
  password: z.string().min(1),
});

export const integrityReportItemSchema = z.object({
  chapter_id: z.string().optional(),
  chapter_title: z.string().optional(),
  manga_title: z.string().optional(),
  issue: z.string().optional(),
  telegram_pages: z.number().optional(),
  expected_pages: z.number().optional(),
}).passthrough();

export const verifyLibraryResponseSchema = z.object({
  reports: z.array(integrityReportItemSchema),
});

export const prepareTelegramFailureSchema = z.object({
  chapter_id: z.string().min(1),
  page_index: z.number().int().positive(),
  error: z.string().min(1),
});

export const prepareTelegramResponseSchema = z.object({
  status: z.string().min(1),
  uploaded_pages: z.number().int().nonnegative(),
  failed_pages: z.array(prepareTelegramFailureSchema),
});

export const auditDiscrepancySchema = z.object({
  chapter_id: z.string().min(1),
  title: z.string().min(1),
  remote_pages: z.number().int().nonnegative().optional(),
  status: z.string().min(1),
});

export const auditMangaResponseSchema = z.object({
  manga_id: z.string().min(1),
  manga_title: z.string().min(1),
  discrepancies: z.array(auditDiscrepancySchema),
});

export const syncMangaResponseSchema = z.object({
  status: z.string().min(1),
  count: z.number().int().nonnegative(),
  imported: z.array(z.string().min(1)),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ProviderId = z.infer<typeof providerIdSchema>;
export type ScrapeMode = z.infer<typeof scrapeModeSchema>;
export type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;
export type ScrapeResponse = z.infer<typeof scrapeResponseSchema>;
export type ProviderInfo = z.infer<typeof providerInfoSchema>;
export type ProvidersResponse = z.infer<typeof providersResponseSchema>;
export type SearchParams = z.infer<typeof searchParamsSchema>;
export type SearchResultSource = z.infer<typeof searchResultSourceSchema>;
export type UnifiedSearchResult = z.infer<typeof unifiedSearchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type AiSearchAnalysis = z.infer<typeof aiSearchAnalysisSchema>;
export type AiSearchResponse = z.infer<typeof aiSearchResponseSchema>;
export type PreviewRequest = z.infer<typeof previewRequestSchema>;
export type PreviewResponse = z.infer<typeof previewResponseSchema>;
export type SourceChapter = z.infer<typeof sourceChapterSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
export type DownloadRequest = z.infer<typeof downloadRequestSchema>;
export type DownloadStatus = z.infer<typeof downloadStatusSchema>;
export type DownloadJob = z.infer<typeof downloadJobSchema>;
export type DownloadsResponse = z.infer<typeof downloadsResponseSchema>;
export type LibraryPage = z.infer<typeof libraryPageSchema>;
export type LibraryChapter = z.infer<typeof libraryChapterSchema>;
export type LibraryManga = z.infer<typeof libraryMangaSchema>;
export type LibraryIndex = z.infer<typeof libraryIndexSchema>;
export type ReaderChapterNav = z.infer<typeof readerChapterNavSchema>;
export type ReaderChapterPayload = z.infer<typeof readerChapterPayloadSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type SolveAuthRequest = z.infer<typeof solveAuthRequestSchema>;
export type AccountRequest = z.infer<typeof accountRequestSchema>;
export type IntegrityReportItem = z.infer<typeof integrityReportItemSchema>;
export type VerifyLibraryResponse = z.infer<typeof verifyLibraryResponseSchema>;
export type PrepareTelegramFailure = z.infer<typeof prepareTelegramFailureSchema>;
export type PrepareTelegramResponse = z.infer<typeof prepareTelegramResponseSchema>;
export type AuditDiscrepancy = z.infer<typeof auditDiscrepancySchema>;
export type AuditMangaResponse = z.infer<typeof auditMangaResponseSchema>;
export type SyncMangaResponse = z.infer<typeof syncMangaResponseSchema>;
