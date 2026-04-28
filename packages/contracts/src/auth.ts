import { z } from 'zod';
import { providerIdSchema, type ProviderId } from './providers.js';

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

export type AuthSession = z.infer<typeof authSessionSchema>;
export type SolveAuthRequest = z.infer<typeof solveAuthRequestSchema>;
export type AccountRequest = z.infer<typeof accountRequestSchema>;
