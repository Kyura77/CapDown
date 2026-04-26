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

const LibraryContext = createContext();

export const useLibrary = () => useContext(LibraryContext);

export const LibraryProvider = ({ children }) => {
  const [library, setLibrary] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshLibrary = useCallback(async () => {
    try {
      const response = await api.getLibrary();
      setLibrary(response.data);
    } catch (error) {
      console.error('Failed to fetch library:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await refreshLibrary();
      setLoading(false);
    };
    init();
  }, [refreshLibrary]);

  const value = useMemo(
    () => ({ library, loading, refreshLibrary }),
    [library, loading, refreshLibrary],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};
