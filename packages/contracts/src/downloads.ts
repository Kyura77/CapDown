import { z } from 'zod';

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

export type DownloadRequest = z.infer<typeof downloadRequestSchema>;
export type DownloadStatus = z.infer<typeof downloadStatusSchema>;
export type DownloadJob = z.infer<typeof downloadJobSchema>;
export type DownloadsResponse = z.infer<typeof downloadsResponseSchema>;
