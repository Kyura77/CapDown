import { z } from 'zod';
import { providerIdSchema, type ProviderId } from './providers.js';

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

export type PreviewRequest = z.infer<typeof previewRequestSchema>;
export type SourceChapter = z.infer<typeof sourceChapterSchema>;
export type PreviewResponse = z.infer<typeof previewResponseSchema>;
