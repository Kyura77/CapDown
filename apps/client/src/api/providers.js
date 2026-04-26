const FALLBACK_PROVIDER_LABELS = {
  manga_dex: 'MangaDex',
  verdinha: 'Verdinha',
  comick: 'Comick',
  flower_mangas: 'Flower',
  arthur_scan: 'Arthur',
  capitoons: 'Capitoons',
  ego_toons: 'EgoToons',
  geass_comics: 'Geass',
  hanami_heaven: 'Hanami',
  hiper_cool: 'HiperCool',
  hunters_scans: 'Hunters',
  mediocre_toons: 'Mediocre',
  nexus_toons: 'Nexus',
  tia_manhwa: 'TiaManhwa',
  yomu_comics: 'Yomu',
  blackout_comics: 'Blackout',
  saikai_scan: 'Saikai',
  astra_toons: 'Astra',
  manga_fire: 'MangaFire',
};

function fallbackLabel(providerId) {
  return FALLBACK_PROVIDER_LABELS[providerId] || providerId;
}

export function normalizeProviderCatalog(providers) {
  if (!Array.isArray(providers)) {
    return [];
  }

  return providers
    .filter((provider) => provider && typeof provider.id === 'string' && provider.id.trim())
    .map((provider) => ({
      id: provider.id.trim(),
      name: typeof provider.name === 'string' && provider.name.trim()
        ? provider.name.trim()
        : fallbackLabel(provider.id.trim()),
      domains: Array.isArray(provider.domains)
        ? provider.domains.filter((domain) => typeof domain === 'string' && domain.trim())
        : [],
    }));
}

export function buildProviderLookup(providers) {
  return new Map(normalizeProviderCatalog(providers).map((provider) => [provider.id, provider]));
}

export function getProviderLabel(providerId, providerLookup) {
  if (!providerId) {
    return '';
  }

  const provider = providerLookup instanceof Map ? providerLookup.get(providerId) : null;
  return provider?.name || fallbackLabel(providerId);
}
