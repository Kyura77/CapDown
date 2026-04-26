/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '../api/client';
import { normalizeProviderCatalog } from '../api/providers';

const ProviderCatalogContext = createContext(null);

async function fetchProviderCatalog() {
  const response = await api.getProviders();
  return normalizeProviderCatalog(response.data);
}

export function ProviderCatalogProvider({ children }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshProviders = useCallback(async () => {
    setLoading(true);
    try {
      setProviders(await fetchProviderCatalog());
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadProviders = async () => {
      try {
        const nextProviders = await fetchProviderCatalog();
        if (active) {
          setProviders(nextProviders);
        }
      } catch (error) {
        if (active) {
          console.error('Failed to fetch providers:', error);
          setProviders([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProviders();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ providers, loading, refreshProviders }),
    [loading, providers, refreshProviders],
  );

  return <ProviderCatalogContext.Provider value={value}>{children}</ProviderCatalogContext.Provider>;
}

export function useProviderCatalogContext() {
  return useContext(ProviderCatalogContext);
}
