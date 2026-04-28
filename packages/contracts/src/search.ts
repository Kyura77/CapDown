import { z } from 'zod';
import { providerIdSchema, type ProviderId } from './providers.js';

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

export type SearchParams = z.infer<typeof searchParamsSchema>;
export type SearchResultSource = z.infer<typeof searchResultSourceSchema>;
export type UnifiedSearchResult = z.infer<typeof unifiedSearchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type AiSearchAnalysis = z.infer<typeof aiSearchAnalysisSchema>;
export type AiSearchResponse = z.infer<typeof aiSearchResponseSchema>;
