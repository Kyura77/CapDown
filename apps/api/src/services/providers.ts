import type {
  AiSearchResponse,
  ProviderId,
  SearchParams,
  SearchResponse,
  PreviewResponse,
} from "@capdown/contracts";
import { providerIdSchema } from "@capdown/contracts";
import {
  getProviderAdapter,
  getProviderAdapterByUrl,
  getProviderAdaptersByIds,
  getSupportedProviderCatalog,
  getSupportedProviderIds,
} from "../providers/index.js";
import { dedupeSearchResults, rankSearchResults } from "./search-ranking.js";

export class UnsupportedProviderSelectionError extends Error {
  constructor(
    readonly requested: string[],
    readonly supported: ProviderId[],
  ) {
    super(
      requested.length > 0
        ? `Unsupported provider selection: ${requested.join(", ")}`
        : "No supported providers are available",
    );
    this.name = "UnsupportedProviderSelectionError";
  }
}

export type ProviderSearchWarning = {
  providerId: ProviderId;
  message: string;
};

export type ProviderSearchOutcome = {
  providers: ProviderId[];
  results: SearchResponse;
  warnings: ProviderSearchWarning[];
};

const DEEP_SEARCH_PAGE_LIMIT = 5;

function resolveRequestedProviderAdapters(rawProviders?: string) {
  if (!rawProviders) {
    return getProviderAdaptersByIds(getSupportedProviderIds());
  }

  const requestedIds = rawProviders
    .split(",")
    .map((providerId) => providerId.trim())
    .filter(Boolean)
    .filter((providerId): providerId is ProviderId => providerIdSchema.safeParse(providerId).success);

  const selectedAdapters = getProviderAdaptersByIds(requestedIds);

  if (selectedAdapters.length === 0) {
    throw new UnsupportedProviderSelectionError(requestedIds, getSupportedProviderIds());
  }

  return selectedAdapters;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatProviderList(providerIds: ProviderId[]) {
  return providerIds
    .map((providerId) => getProviderAdapter(providerId)?.info.name ?? providerId)
    .join(", ");
}

async function searchAdapterPages(
  adapter: ReturnType<typeof getProviderAdapter>,
  params: SearchParams,
) {
  if (!adapter) {
    return [];
  }

  const limit = params.limit ?? 20;
  const startPage = params.page ?? 1;
  const pageCount = params.deep ? DEEP_SEARCH_PAGE_LIMIT : 1;
  const collected: SearchResponse = [];
  const seen = new Set<string>();

  for (let offset = 0; offset < pageCount; offset += 1) {
    const page = startPage + offset;
    const pageResults = await adapter.search({
      q: params.q,
      limit,
      page,
      deep: false,
    });

    if (pageResults.length === 0) {
      break;
    }

    for (const result of pageResults) {
      const sourceKey = result.sources
        .map((source) => `${source.provider_id}:${source.source_id}`)
        .sort()
        .join("|") || result.title;

      if (seen.has(sourceKey)) {
        continue;
      }

      seen.add(sourceKey);
      collected.push(result);
    }

    if (pageResults.length < limit) {
      break;
    }
  }

  return collected;
}

export function listProviderCatalog() {
  return getSupportedProviderCatalog();
}

export async function searchProviders(params: SearchParams): Promise<ProviderSearchOutcome> {
  const adapters = resolveRequestedProviderAdapters(params.providers);

  const settled = await Promise.all(
    adapters.map(async (adapter): Promise<
      | { kind: "success"; providerId: ProviderId; results: SearchResponse }
      | { kind: "failure"; providerId: ProviderId; message: string }
    > => {
      try {
        const results = await searchAdapterPages(adapter, params);

        return {
          kind: "success",
          providerId: adapter.info.id,
          results,
        };
      } catch (error) {
        return {
          kind: "failure",
          providerId: adapter.info.id,
          message: toErrorMessage(error),
        };
      }
    }),
  );

  const results: SearchResponse = [];
  const warnings: ProviderSearchWarning[] = [];

  for (const item of settled) {
    if (item.kind === "success") {
      results.push(...item.results);
      continue;
    }

    warnings.push({
      providerId: item.providerId,
      message: item.message,
    });
  }

  const rankedResults = rankSearchResults(params.q, dedupeSearchResults(results));

  return {
    providers: adapters.map((adapter) => adapter.info.id),
    results: rankedResults,
    warnings,
  };
}

export function buildSearchAnalysis(outcome: ProviderSearchOutcome, query: string): AiSearchResponse["analysis"] {
  return {
    interpretation: `Busca executada em ${formatProviderList(outcome.providers)} para "${query}".`,
    search_terms: [query],
    tags: outcome.providers.map((providerId) => providerId),
    ai_powered: false,
  };
}

export async function previewProviderSource(sourceUrl: string): Promise<PreviewResponse> {
  const parsedUrl = new URL(sourceUrl);
  const adapter = getProviderAdapterByUrl(parsedUrl);

  if (!adapter) {
    throw new UnsupportedProviderSelectionError([parsedUrl.hostname], getSupportedProviderIds());
  }

  return adapter.preview(parsedUrl);
}
