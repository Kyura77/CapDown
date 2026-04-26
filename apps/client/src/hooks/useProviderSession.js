import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

async function fetchProviderSession(providerId) {
  const response = await api.getAuthSession(providerId);
  return Boolean(response.data.connected);
}

export function useProviderSession(providerId) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  const refreshSession = useCallback(async () => {
    if (!providerId) {
      setConnected(false);
      setChecking(false);
      return false;
    }

    setChecking(true);
    try {
      const nextConnected = await fetchProviderSession(providerId);
      setConnected(nextConnected);
      return nextConnected;
    } catch (error) {
      console.error(`Failed to fetch auth session for ${providerId}:`, error);
      setConnected(false);
      return false;
    } finally {
      setChecking(false);
    }
  }, [providerId]);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      if (!providerId) {
        if (active) {
          setConnected(false);
          setChecking(false);
        }
        return;
      }

      if (active) {
        setChecking(true);
      }

      try {
        const nextConnected = await fetchProviderSession(providerId);
        if (active) {
          setConnected(nextConnected);
        }
      } catch (error) {
        if (active) {
          console.error(`Failed to fetch auth session for ${providerId}:`, error);
          setConnected(false);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };

    void loadSession();

    return () => {
      active = false;
    };
  }, [providerId]);

  return {
    connected,
    checking,
    refreshSession,
  };
}
