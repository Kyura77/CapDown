import type { FastifyInstance } from "fastify";
import { downloadRequestSchema } from "@capdown/contracts";
import { sendAppError } from "../store/errors.js";
import type { ProductStateService } from "../store/product-state-service.js";

export async function registerDownloadRoutes(app: FastifyInstance, stateService: ProductStateService) {
  app.post("/api/downloads", async (request, reply) => {
    try {
      const parsed = downloadRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: "invalid_request",
          message: "Invalid download payload",
          details: parsed.error.flatten(),
        });
      }

      return await stateService.createDownload(parsed.data);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.get("/api/downloads", async (request, reply) => {
    try {
      return await stateService.listDownloads();
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.get("/api/downloads/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await stateService.getDownload(id);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.delete("/api/downloads/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return await stateService.deleteDownload(id);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });
}
