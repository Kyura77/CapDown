import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LibraryProvider }        from './context/LibraryContext';
import { DownloadsProvider }      from './context/DownloadsContext';
import { ProviderCatalogProvider } from './context/ProviderCatalogContext';
import { ToastProvider }           from './components/Toast';
import { BottomNav }               from './components/BottomNav';
import Dashboard     from './pages/Dashboard';
import DownloadsPage from './pages/DownloadsPage';
import MangaDetail   from './pages/MangaDetail';
import ReaderView    from './pages/ReaderView';
import RecentView    from './pages/RecentView';
import SettingsPage  from './pages/SettingsPage';

const PAGE_TRANSITION = {
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -10 },
  transition: { type: 'spring', stiffness: 380, damping: 30 },
};

function AppShell() {
  const location = useLocation();
  const isReader = location.pathname.startsWith('/reader');

  return (
    <div className="h-dvh w-full overflow-hidden bg-[var(--color-background)] relative">
      {/* Main scrollable area */}
      {!isReader && (
        <main className="absolute inset-0 overflow-y-auto overscroll-none pb-20">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} {...PAGE_TRANSITION}>
              <Routes location={location}>
                <Route path="/"                             element={<Dashboard />} />
                <Route path="/downloads"                    element={<DownloadsPage />} />
                <Route path="/recent"                       element={<RecentView />} />
                <Route path="/manga/:id"                    element={<MangaDetail />} />
                <Route path="/settings"                     element={<SettingsPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      )}

      {/* Reader gets full screen via fixed layout */}
      {isReader && (
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/reader/:mangaId/:chapterId" element={<ReaderView />} />
          </Routes>
        </AnimatePresence>
      )}

      {/* Bottom Nav — only outside reader */}
      {!isReader && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ProviderCatalogProvider>
        <LibraryProvider>
          <DownloadsProvider>
            <Router>
              <AppShell />
            </Router>
          </DownloadsProvider>
        </LibraryProvider>
      </ProviderCatalogProvider>
    </ToastProvider>
  );
}
