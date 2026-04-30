import { z } from 'zod';

export const appSettingsSchema = z.object({
  telegram_token: z.string().nullable().optional(),
  telegram_chat_id: z.string().nullable().optional(),
  enabled_providers: z.array(z.string()).optional(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
