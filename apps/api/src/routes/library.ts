import type { FastifyInstance } from "fastify";
import { sendAppError } from "../store/errors.js";
import type { ProductStateService } from "../store/product-state-service.js";

export async function registerLibraryRoutes(app: FastifyInstance, stateService: ProductStateService) {
  app.get("/api/library", async (request, reply) => {
    try {
      return await stateService.listLibrary();
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.post("/api/library/verify", async (request, reply) => {
    try {
      return await stateService.verifyLibrary();
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.get("/api/library/pages/TELEGRAM/:chapterId/:index", async (request, reply) => {
    try {
      const { chapterId, index } = request.params as { chapterId: string; index: string };
      const payload = await stateService.getTelegramPageImage(chapterId, Number(index));
      return reply.type(payload.contentType).send(payload.body);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.get("/api/library/pages/:provider/:chapterId/:index", async (request, reply) => {
    try {
      const { provider } = request.params as { provider: string };
      return reply.status(501).send({
        code: "unsupported_page_provider",
        message: `Page backend for provider \"${provider}\" is not available in the transitional store`,
      });
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.get("/api/library/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await stateService.getManga(id);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.delete("/api/library/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await stateService.deleteManga(id);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.get("/api/library/:mangaId/chapters/:chapterId", async (request, reply) => {
    try {
      const { mangaId, chapterId } = request.params as { mangaId: string; chapterId: string };
      return await stateService.getReaderChapter(mangaId, chapterId);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.post("/api/library/:id/sync", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await stateService.syncManga(id);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.post("/api/library/:id/prepare-telegram", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await stateService.prepareTelegram(id);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.post("/api/library/:id/audit", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await stateService.auditManga(id);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.post("/api/library/backfill-covers", async (_request, reply) => {
    try {
      return await stateService.backfillCovers();
    } catch (error) {
      return sendAppError(reply, error);
    }
  });
}
