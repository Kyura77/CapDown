import type { FastifyInstance } from "fastify";
import { searchParamsSchema } from "@capdown/contracts";
import {
  buildSearchAnalysis,
  searchProviders,
  UnsupportedProviderSelectionError,
} from "../services/providers.js";

export async function registerSearchRoutes(app: FastifyInstance) {
  app.get("/api/search", async (request, reply) => {
    const parsed = searchParamsSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'invalid_request',
        message: 'Invalid search parameters',
        details: parsed.error.flatten(),
      });
    }

    try {
      const outcome = await searchProviders(parsed.data);

      if (outcome.warnings.length > 0) {
        app.log.warn(
          {
            query: parsed.data.q,
            providers: outcome.providers,
            warnings: outcome.warnings,
          },
          "One or more providers failed during search",
        );
      }

      if (outcome.results.length === 0 && outcome.warnings.length > 0) {
        return reply.status(502).send({
          code: "provider_request_failed",
          message: "All selected providers failed to respond to the search request.",
          details: outcome.warnings,
        });
      }

      return outcome.results;
    } catch (error) {
      if (error instanceof UnsupportedProviderSelectionError) {
        return reply.status(400).send({
          code: "unsupported_provider_selection",
          message: error.message,
          details: {
            requested: error.requested,
            supported: error.supported,
          },
        });
      }

      app.log.error(error);
      return reply.status(502).send({
        code: "provider_request_failed",
        message: "Search request failed.",
      });
    }
  });

  app.get("/api/search/ai", async (request, reply) => {
    const parsed = searchParamsSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        code: "invalid_request",
        message: "Invalid AI search parameters",
        details: parsed.error.flatten(),
      });
    }

    try {
      const outcome = await searchProviders(parsed.data);

      if (outcome.warnings.length > 0) {
        app.log.warn(
          {
            query: parsed.data.q,
            providers: outcome.providers,
            warnings: outcome.warnings,
          },
          "One or more providers failed during AI search",
        );
      }

      if (outcome.results.length === 0 && outcome.warnings.length > 0) {
        return reply.status(502).send({
          code: "provider_request_failed",
          message: "All selected providers failed to respond to the search request.",
          details: outcome.warnings,
        });
      }

      return {
        analysis: buildSearchAnalysis(outcome, parsed.data.q),
        results: outcome.results,
      };
    } catch (error) {
      if (error instanceof UnsupportedProviderSelectionError) {
        return reply.status(400).send({
          code: "unsupported_provider_selection",
          message: error.message,
          details: {
            requested: error.requested,
            supported: error.supported,
          },
        });
      }

      app.log.error(error);
      return reply.status(502).send({
        code: "provider_request_failed",
        message: "Search request failed.",
      });
    }
  });
}
