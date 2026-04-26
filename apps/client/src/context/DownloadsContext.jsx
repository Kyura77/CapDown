/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api } from '../api/client';
import { useLibrary } from './LibraryContext';

const DownloadsContext = createContext();

export const useDownloads = () => useContext(DownloadsContext);

export function DownloadsProvider({ children }) {
  const { refreshLibrary } = useLibrary();
  const [downloads, setDownloads] = useState([]);
  const isRefreshing = useRef(false);
  const previousDownloadsRef = useRef([]);

  const refreshDownloads = useCallback(async () => {
    try {
      const response = await api.getDownloads();
      setDownloads(response.data);
    } catch (error) {
      console.error('Failed to fetch downloads:', error);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.getDownloads()
      .then((response) => {
        if (active) {
          setDownloads(response.data);
        }
      })
      .catch((error) => {
        console.error('Failed to fetch downloads:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const hasActiveJobs = downloads.some(
      (job) => job.status === 'queued' || job.status === 'downloading',
    );

    if (!hasActiveJobs) {
      return undefined;
    }

    const interval = setInterval(async () => {
      if (isRefreshing.current) {
        return;
      }

      isRefreshing.current = true;
      try {
        await refreshDownloads();
      } finally {
        isRefreshing.current = false;
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [downloads, refreshDownloads]);

  useEffect(() => {
    const previous = previousDownloadsRef.current;
    const completedRecently = previous.some(
      (oldJob) =>
        oldJob.status === 'downloading' &&
        downloads.find((job) => job.id === oldJob.id)?.status === 'completed',
    );

    if (completedRecently) {
      refreshLibrary().catch(console.error);
    }

    previousDownloadsRef.current = downloads;
  }, [downloads, refreshLibrary]);

  const value = useMemo(
    () => ({ downloads, refreshDownloads }),
    [downloads, refreshDownloads],
  );

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}
