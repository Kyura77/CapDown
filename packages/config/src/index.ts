import { z } from "zod";

export const apiEnvSchema = z.object({
  CAPDOWN_V2_API_HOST: z.string().min(1).default("127.0.0.1"),
  CAPDOWN_V2_API_PORT: z.coerce.number().int().positive().default(4540),
  CAPDOWN_V2_SCRAPER_URL: z.string().url().default("http://127.0.0.1:8001"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(source);
}
