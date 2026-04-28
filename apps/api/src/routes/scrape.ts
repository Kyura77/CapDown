import type { FastifyInstance } from 'fastify';
import { scrapeRequestSchema } from '@capdown/contracts';
import { ScraperClient } from '../clients/scraper.js';

export async function registerScrapeRoute(
  app: FastifyInstance,
  scraperClient: ScraperClient,
) {
  app.post('/v1/scrape', async (request, reply) => {
    const parsed = scrapeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'invalid_request',
        message: 'Invalid scrape request payload',
        details: parsed.error.flatten(),
      });
    }

    const result = await scraperClient.scrape(parsed.data);
    return reply.status(202).send(result);
  });
}
