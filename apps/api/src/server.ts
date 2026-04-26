import Fastify from "fastify";
import cors from "@fastify/cors";
import type { ApiConfig } from "./config.js";
import { ScraperClient } from "./clients/scraper.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerDownloadRoutes } from "./routes/downloads.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerLibraryRoutes } from "./routes/library.js";
import { registerPreviewRoute } from "./routes/preview.js";
import { registerProvidersRoute } from "./routes/providers.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerScrapeRoute } from "./routes/scrape.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { AppStateRepository } from "./repositories/app-state-repository.js";
import { ProductStateService } from "./store/product-state-service.js";

export async function buildServer(config: ApiConfig) {
  const app = Fastify({ logger: true });
  
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
  });

  app.addContentTypeParser("*", { parseAs: "string" }, async (_request: unknown, body: string) => {
    if (typeof body !== "string" || body.trim().length === 0) {
      return null;
    }

    return body;
  });

  const scraperClient = new ScraperClient(config.scraperBaseUrl);
  const stateRepository = new AppStateRepository();
  const stateService = new ProductStateService(stateRepository);
  await stateService.init();

  await registerHealthRoute(app);
  await registerProvidersRoute(app);
  await registerSearchRoutes(app);
  await registerPreviewRoute(app);
  await registerDownloadRoutes(app, stateService);
  await registerLibraryRoutes(app, stateService);
  await registerSettingsRoutes(app, stateService);
  await registerAuthRoutes(app, stateService);
  await registerScrapeRoute(app, scraperClient);

  return app;
}
