import { z } from 'zod';
import { providerIdSchema, type ProviderId } from './providers.js';

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

export type LibraryPage = z.infer<typeof libraryPageSchema>;
export type LibraryChapter = z.infer<typeof libraryChapterSchema>;
export type LibraryManga = z.infer<typeof libraryMangaSchema>;
export type LibraryIndex = z.infer<typeof libraryIndexSchema>;
export type ReaderChapterNav = z.infer<typeof readerChapterNavSchema>;
export type ReaderChapterPayload = z.infer<typeof readerChapterPayloadSchema>;
export type IntegrityReportItem = z.infer<typeof integrityReportItemSchema>;
export type VerifyLibraryResponse = z.infer<typeof verifyLibraryResponseSchema>;
export type PrepareTelegramFailure = z.infer<typeof prepareTelegramFailureSchema>;
export type PrepareTelegramResponse = z.infer<typeof prepareTelegramResponseSchema>;
export type AuditDiscrepancy = z.infer<typeof auditDiscrepancySchema>;
export type AuditMangaResponse = z.infer<typeof auditMangaResponseSchema>;
export type SyncMangaResponse = z.infer<typeof syncMangaResponseSchema>;
