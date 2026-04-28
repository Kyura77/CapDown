import type { FastifyInstance } from 'fastify';
import { appSettingsSchema } from '@capdown/contracts';
import { sendAppError } from "../store/errors.js";
import type { ProductStateService } from "../store/product-state-service.js";

export async function registerSettingsRoutes(app: FastifyInstance, stateService: ProductStateService) {
  app.get('/api/settings', async (_request, reply) => {
    try {
      const settings = await stateService.getSettings();
      // Never return the full token — only signal whether it is configured
      return {
        has_telegram_token: Boolean(settings.telegram_token),
        telegram_chat_id: settings.telegram_chat_id ?? '',
      };
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.post('/api/settings', async (request, reply) => {
    try {
      const parsed = appSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'invalid_request',
          message: 'Invalid settings payload',
          details: parsed.error.flatten(),
        });
      }

      return await stateService.saveSettings(parsed.data);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });
}
