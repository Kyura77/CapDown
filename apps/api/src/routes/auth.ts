import type { FastifyInstance } from "fastify";
import { accountRequestSchema, solveAuthRequestSchema } from "@capdown/contracts";
import { sendAppError } from "../store/errors.js";
import type { ProductStateService } from "../store/product-state-service.js";

export async function registerAuthRoutes(app: FastifyInstance, stateService: ProductStateService) {
  app.post("/api/auth/accounts", async (request, reply) => {
    try {
      const parsed = accountRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: "invalid_request",
          message: "Invalid account payload",
          details: parsed.error.flatten(),
        });
      }

      return await stateService.saveAccount(parsed.data);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.get("/api/auth/session/:providerId", async (request, reply) => {
    try {
      const { providerId } = request.params as { providerId: string };
      return await stateService.getAuthSession(providerId);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });

  app.post("/api/auth/solve", async (request, reply) => {
    try {
      const parsed = solveAuthRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: "invalid_request",
          message: "Invalid solve auth payload",
          details: parsed.error.flatten(),
        });
      }

      return await stateService.solveAuth(parsed.data);
    } catch (error) {
      return sendAppError(reply, error);
    }
  });
}
