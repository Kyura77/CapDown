import { z } from 'zod';

export const scrapeModeSchema = z.enum(['manga', 'chapter', 'search']);

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

export type ScrapeMode = z.infer<typeof scrapeModeSchema>;
export type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;
export type ScrapeResponse = z.infer<typeof scrapeResponseSchema>;
