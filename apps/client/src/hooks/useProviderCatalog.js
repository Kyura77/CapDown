import { useProviderCatalogContext } from '../context/ProviderCatalogContext';

export function useProviderCatalog() {
  const context = useProviderCatalogContext();

  if (!context) {
    throw new Error('useProviderCatalog must be used within a ProviderCatalogProvider');
  }

  return context;
}
