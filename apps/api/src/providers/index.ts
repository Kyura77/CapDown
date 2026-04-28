import type { ProviderId, ProviderInfo } from "@capdown/contracts";
import { mangaDexAdapter } from "./mangadex.js";
import { verdinhaAdapter } from "./verdinha.js";
import { egoToonsAdapter } from "./egotoons.js";
import type { ProviderAdapter } from "./types.js";

const providerAdapters: ProviderAdapter[] = [verdinhaAdapter, mangaDexAdapter, egoToonsAdapter];

const adaptersById = new Map<ProviderId, ProviderAdapter>(
  providerAdapters.map((adapter) => [adapter.info.id, adapter]),
);

import { providerIdSchema } from "@capdown/contracts";

export function getSupportedProviderCatalog(): ProviderInfo[] {
  // Return all known providers. If they have an adapter, use its info (status: enabled).
  // Otherwise, return a stub with status: unavailable.
  return providerIdSchema.options.map((id) => {
    const adapter = adaptersById.get(id);
    if (adapter) {
      return adapter.info;
    }
    return {
      id,
      name: id.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      domains: [],
      status: "unavailable",
    };
  });
}

export function getSupportedProviderIds(): ProviderId[] {
  return providerAdapters.map((adapter) => adapter.info.id);
}

export function getProviderAdapter(providerId: ProviderId): ProviderAdapter | undefined {
  return adaptersById.get(providerId);
}

export function getProviderAdapterByUrl(url: URL): ProviderAdapter | undefined {
  return providerAdapters.find((adapter) => adapter.canHandleUrl(url));
}

export function getProviderAdaptersByIds(providerIds: ProviderId[]): ProviderAdapter[] {
  const adapters = providerIds
    .map((providerId) => adaptersById.get(providerId))
    .filter((adapter): adapter is ProviderAdapter => Boolean(adapter));

  return Array.from(new Map(adapters.map((adapter) => [adapter.info.id, adapter])).values());
}
