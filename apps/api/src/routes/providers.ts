import type { FastifyInstance } from "fastify";
import { listProviderCatalog } from "../services/providers.js";

export async function registerProvidersRoute(app: FastifyInstance) {
  app.get("/api/providers", async (request, reply) => {
    return listProviderCatalog();
  });
}
