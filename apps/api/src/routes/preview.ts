import type { FastifyInstance } from "fastify";
import { previewRequestSchema } from "@capdown/contracts";
import { UnsupportedProviderSelectionError, previewProviderSource } from "../services/providers.js";

export async function registerPreviewRoute(app: FastifyInstance) {
  app.post("/api/preview", async (request, reply) => {
    const parsed = previewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: "invalid_request",
        message: "Invalid preview payload",
        details: parsed.error.flatten(),
      });
    }

    try {
      return await previewProviderSource(parsed.data.url);
    } catch (error) {
      if (error instanceof UnsupportedProviderSelectionError) {
        return reply.status(400).send({
          code: "unsupported_provider_selection",
          message: "The provided URL does not match a supported provider.",
          details: {
            requested: error.requested,
            supported: error.supported,
          },
        });
      }

      app.log.error(error);
      return reply.status(502).send({
        code: "provider_request_failed",
        message: "Preview request failed.",
      });
    }
  });
}
