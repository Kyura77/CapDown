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
  const [error, setError] = useState(null);

  const refreshProviders = useCallback(async () => {
    setLoading(true);
    try {
      setProviders(await fetchProviderCatalog());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch providers:', err);
      setProviders([]);
      setError(err);
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
          setError(null);
        }
      } catch (err) {
        if (active) {
          console.error('Failed to fetch providers:', err);
          setProviders([]);
          setError(err);
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
    () => ({ providers, loading, error, refreshProviders }),
    [loading, error, providers, refreshProviders],
  );

  return <ProviderCatalogContext.Provider value={value}>{children}</ProviderCatalogContext.Provider>;
}

export function useProviderCatalogContext() {
  return useContext(ProviderCatalogContext);
}
