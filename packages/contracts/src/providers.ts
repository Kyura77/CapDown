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

export const providerInfoSchema = z.object({
  id: providerIdSchema,
  name: z.string().min(1),
  domains: z.array(z.string().min(1)),
  status: z.enum(['enabled', 'unavailable']).optional().default('unavailable'),
});

export const providersResponseSchema = z.array(providerInfoSchema);

export type ProviderId = z.infer<typeof providerIdSchema>;
export type ProviderInfo = z.infer<typeof providerInfoSchema>;
export type ProvidersResponse = z.infer<typeof providersResponseSchema>;
