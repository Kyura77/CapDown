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
import { ProductStateService } from "./store/product-state-service.js";
import { sendAppError } from "./store/errors.js";
import { PrismaClient } from "@prisma/client";
import { PrismaSettingsRepository } from "./repositories/prisma-settings-repository.js";
import { PrismaAuthRepository } from "./repositories/prisma-auth-repository.js";
import { PrismaLibraryRepository } from "./repositories/prisma-library-repository.js";
import { PrismaDownloadsRepository } from "./repositories/prisma-downloads-repository.js";

export async function buildServer(config: ApiConfig) {
  const app = Fastify({ logger: true });
  
  // CORS: allow origins explicitly. CAPDOWN_CORS_ORIGINS env var can override (comma-separated).
  // Defaults to development origins. Never use origin:true in production.
  const corsOrigins = process.env.CAPDOWN_CORS_ORIGINS
    ? process.env.CAPDOWN_CORS_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4173',
        'capacitor://localhost',
        // Android LAN — override via env in production
        /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
      ];

  await app.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
  });

  app.addContentTypeParser("*", { parseAs: "string" }, async (_request: unknown, body: string) => {
    if (typeof body !== "string" || body.trim().length === 0) {
      return null;
    }

    return body;
  });
  
  app.setErrorHandler((error, request, reply) => {
    return sendAppError(reply, error);
  });

  app.addHook('preHandler', async (request, reply) => {
    const url = request.routeOptions.url || request.url;
    // Allow public read-only access to some routes
    const isPublicGet = request.method === 'GET' && (
      url.startsWith('/api/health') ||
      url.startsWith('/api/library') ||
      url.startsWith('/api/search') ||
      url.startsWith('/api/downloads') ||
      url.startsWith('/api/providers')
    );
    // Settings GET is not public because it contains sensitive config
    const isSettingsGet = request.method === 'GET' && url.startsWith('/api/settings');

    if (!isPublicGet || isSettingsGet) {
      const apiKey = process.env.CAPDOWN_API_KEY || 'dev-key-123';
      const providedKey = request.headers['x-api-key'] || request.headers['authorization'];
      
      if (providedKey !== apiKey && providedKey !== `Bearer ${apiKey}`) {
        return reply.status(401).send({
          code: 'unauthorized',
          message: 'Authentication required. Invalid or missing API key.',
        });
      }
    }
  });

  const prisma = new PrismaClient();
  const scraperClient = new ScraperClient(config.scraperBaseUrl);

  const settingsRepo = new PrismaSettingsRepository(prisma);
  const authRepo = new PrismaAuthRepository(prisma);
  const libraryRepo = new PrismaLibraryRepository(prisma);
  const downloadsRepo = new PrismaDownloadsRepository(prisma);

  const stateService = new ProductStateService(
    settingsRepo,
    authRepo,
    libraryRepo,
    downloadsRepo
  );
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
