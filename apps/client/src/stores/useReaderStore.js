import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useReaderStore = create(
  persist(
    (set) => ({
      // Preferences
      readingMode: 'webtoon', // 'webtoon' or 'manga'
      zoomLevel: 100,
      brightness: 100,
      
      // Progress Tracking
      progress: {}, // { mangaId: { chapterId, pageIndex } }
      
      // Actions
      setReadingMode: (mode) => set({ readingMode: mode }),
      setZoomLevel: (level) => set({ zoomLevel: level }),
      setBrightness: (level) => set({ brightness: level }),
      
      saveProgress: (mangaId, chapterId, pageIndex) => 
        set((state) => ({
          progress: {
            ...state.progress,
            [mangaId]: { chapterId, pageIndex }
          }
        })),
        
      getProgress: (mangaId) => (state) => state.progress[mangaId] || null,
    }),
    {
      name: 'capdown-reader-storage',
    }
  )
);
