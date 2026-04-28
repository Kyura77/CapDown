import { z } from 'zod';

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string().min(1),
  runtime: z.string().min(1),
});

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export const statusResponseSchema = z.object({
  status: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
