import type { ProviderId, ProviderInfo } from "@capdown/contracts";
import { mangaDexAdapter } from "./mangadex.js";
import { verdinhaAdapter } from "./verdinha.js";
import type { ProviderAdapter } from "./types.js";

const providerAdapters: ProviderAdapter[] = [verdinhaAdapter, mangaDexAdapter];

const adaptersById = new Map<ProviderId, ProviderAdapter>(
  providerAdapters.map((adapter) => [adapter.info.id, adapter]),
);

export function getSupportedProviderCatalog(): ProviderInfo[] {
  return providerAdapters.map((adapter) => adapter.info);
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
