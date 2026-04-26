import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { BookOpen, Download, Home, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { LibraryProvider } from './context/LibraryContext';
import { DownloadsProvider } from './context/DownloadsContext';
import { ProviderCatalogProvider } from './context/ProviderCatalogContext';
import Dashboard from './pages/Dashboard';
import DownloadsPage from './pages/DownloadsPage';
import MangaDetail from './pages/MangaDetail';
import ReaderView from './pages/ReaderView';
import SettingsPage from './pages/SettingsPage';
import RecentView from './pages/RecentView';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';

const AppShell = () => {
  const location = useLocation();
  const isReader = location.pathname.startsWith('/reader');

  return (
    <div className="app-glass-shell">
      {!isReader && <Sidebar />}
      <main className="main-glass-scroll">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={isReader ? false : { opacity: 0, y: 10 }}
            animate={isReader ? undefined : { opacity: 1, y: 0 }}
            exit={isReader ? undefined : { opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.7 }}
            style={{ minHeight: '100%' }}
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/downloads" element={<DownloadsPage />} />
              <Route path="/recent" element={<RecentView />} />
              <Route path="/manga/:id" element={<MangaDetail />} />
              <Route path="/reader/:mangaId/:chapterId" element={<ReaderView />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      {!isReader && <BottomNav />}
    </div>
  );
};

export default function App() {
  return (
    <ProviderCatalogProvider>
      <LibraryProvider>
        <DownloadsProvider>
          <Router>
            <AppShell />
          </Router>
        </DownloadsProvider>
      </LibraryProvider>
    </ProviderCatalogProvider>
  );
}
