import {
  type ScrapeRequest,
  type ScrapeResponse,
  scrapeResponseSchema,
} from '@capdown/contracts';

export class ScraperClient {
  constructor(private readonly baseUrl: string) {}

  async scrape(request: ScrapeRequest): Promise<ScrapeResponse> {
    const response = await fetch(`${this.baseUrl}/scrape`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Scraper request failed with HTTP ${response.status}`);
    }

    return scrapeResponseSchema.parse(await response.json());
  }
}
