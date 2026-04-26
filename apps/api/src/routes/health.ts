import type { FastifyInstance } from 'fastify';
import { healthResponseSchema } from '@capdown/contracts';

export async function registerHealthRoute(app: FastifyInstance) {
  app.get('/api/health', async () =>
    healthResponseSchema.parse({
      ok: true,
      service: 'capdown-v2-api',
      runtime: 'node',
    }));

  app.get('/health', async () =>
    healthResponseSchema.parse({
      ok: true,
      service: 'capdown-v2-api',
      runtime: 'node',
    }));
}
