import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '../api/client';
import { useReaderStore } from '../stores/useReaderStore';

export default function ReaderView() {
  const { mangaId, chapterId } = useParams();
  const navigate = useNavigate();
  const { saveProgress, zoomLevel, brightness } = useReaderStore();

  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [hud, setHud] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const scrollRef = useRef(null);
  const hudTimer = useRef(null);

  // Lock body overscroll for native feel
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
    };
  }, []);

  // Load chapter
  useEffect(() => {
    let alive = true;
    setPayload(null);
    setError(null);
    api.getReaderChapter(mangaId, chapterId)
      .then(r => { if (alive) setPayload(r.data); })
      .catch(err => { if (alive) setError(err); });
    return () => { alive = false; };
  }, [mangaId, chapterId]);

  // Save reading progress when payload is ready
  useEffect(() => {
    if (payload) {
      saveProgress(mangaId, chapterId, 0);
    }
  }, [payload, mangaId, chapterId, saveProgress]);

  // Keyboard nav
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape') navigate(-1);
      if (e.key === 'ArrowLeft' && payload?.prev_chapter) navigate(`/reader/${mangaId}/${payload.prev_chapter.id}`);
      if (e.key === 'ArrowRight' && payload?.next_chapter) navigate(`/reader/${mangaId}/${payload.next_chapter.id}`);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, mangaId, payload]);

  const chapter = payload?.chapter ?? null;
  const pages = useMemo(() => {
    if (!chapter || !payload?.pages?.length) return [];
    return payload.pages.map(p => api.getTelegramPageUrl(chapter.id, p.index));
  }, [chapter, payload]);

  // React Virtual for performance
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => window.innerWidth * 1.42, // Approx manga page ratio
    overscan: 3,
  });

  // HUD auto-hide on scroll
  const handleScroll = useCallback(() => {
    clearTimeout(hudTimer.current);
    setHud(true);
    hudTimer.current = setTimeout(() => setHud(false), 2800);
  }, []);

  const toggleHud = () => setHud(v => !v);

  // Navigation
  const goToChapter = (ch) => {
    if (!ch) return;
    navigate(`/reader/${mangaId}/${ch.id}`);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  // --- Loading state ---
  if (!payload && !error) return (
    <div className="fixed inset-0 bg-[var(--color-background)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-brand-400" />
        <p className="text-sm text-[var(--color-text-muted)]">Carregando capítulo...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="fixed inset-0 bg-[var(--color-background)] flex flex-col items-center justify-center gap-4">
      <span className="text-5xl">⚠️</span>
      <p className="text-red-400 text-sm text-center px-8">Falha ao carregar capítulo.</p>
      <button
        className="mt-2 px-5 py-2.5 rounded-xl bg-[var(--color-surface)] text-sm text-white hover:bg-[var(--color-surface-hover)] transition-colors"
        onClick={() => navigate(-1)}
      >
        Voltar
      </button>
    </div>
  );

  if (!chapter) return (
    <div className="fixed inset-0 bg-[var(--color-background)] flex items-center justify-center">
      <p className="text-[var(--color-text-muted)] text-sm">Capítulo não encontrado.</p>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black overflow-hidden"
      style={{ filter: brightness !== 100 ? `brightness(${brightness / 100})` : undefined }}
    >
      {/* Top HUD */}
      <AnimatePresence>
        {hud && (
          <motion.div
            className="absolute top-0 left-0 right-0 z-50 safe-pt"
            initial={{ opacity: 0, y: -44 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -44 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="glass-elevated flex items-center gap-3 px-4 py-3 mx-3 mt-3 rounded-2xl">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 rounded-xl hover:bg-white/10 transition-colors"
                aria-label="Voltar"
              >
                <ChevronLeft size={20} className="text-white" />
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{payload.manga_title}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate">{chapter.title}</p>
              </div>

              <button
                onClick={() => setFullscreen(v => !v)}
                className="p-1.5 rounded-xl hover:bg-white/10 transition-colors"
                aria-label="Fullscreen"
              >
                {fullscreen ? <Minimize2 size={17} className="text-white" /> : <Maximize2 size={17} className="text-white" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page scroll — Webtoon infinite vertical */}
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-auto overscroll-none"
        onScroll={handleScroll}
        onClick={toggleHud}
        style={{ scrollbarWidth: 'none' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualItem => (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <img
                src={pages[virtualItem.index]}
                alt={`Página ${virtualItem.index + 1}`}
                className="w-full h-full object-contain"
                style={{
                  maxWidth: fullscreen ? '100%' : `${zoomLevel}%`,
                  margin: '0 auto',
                  display: 'block',
                }}
                loading={virtualItem.index < 3 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>

        {/* Chapter Navigation Footer (inside scroll at bottom) */}
        {pages.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-8 gap-4"
            onClick={e => e.stopPropagation()}
          >
            <motion.button
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-colors ${payload.prev_chapter ? 'bg-[var(--color-surface)] text-white hover:bg-[var(--color-surface-hover)]' : 'bg-[var(--color-surface)]/40 text-[var(--color-text-muted)] cursor-not-allowed'}`}
              whileTap={{ scale: payload.prev_chapter ? 0.96 : 1 }}
              disabled={!payload.prev_chapter}
              onClick={() => goToChapter(payload.prev_chapter)}
            >
              <ChevronLeft size={18} />
              Anterior
            </motion.button>

            <motion.button
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-colors ${payload.next_chapter ? 'bg-brand-500 text-white hover:bg-brand-400' : 'bg-[var(--color-surface)]/40 text-[var(--color-text-muted)] cursor-not-allowed'}`}
              whileTap={{ scale: payload.next_chapter ? 0.96 : 1 }}
              disabled={!payload.next_chapter}
              onClick={() => goToChapter(payload.next_chapter)}
            >
              Próximo
              <ChevronRight size={18} />
            </motion.button>
          </div>
        )}
      </div>

      {/* Bottom HUD (Progress) */}
      <AnimatePresence>
        {hud && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-50 safe-pb"
            initial={{ opacity: 0, y: 44 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 44 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="glass-elevated flex items-center gap-3 px-4 py-3 mx-3 mb-3 rounded-2xl">
              {/* Prev/Next quick buttons */}
              <button
                disabled={!payload.prev_chapter}
                onClick={() => goToChapter(payload.prev_chapter)}
                className="p-1.5 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                <ChevronLeft size={20} className="text-white" />
              </button>

              {/* Chapter indicator */}
              <div className="flex-1 text-center">
                <p className="text-xs font-semibold text-brand-400">
                  {chapter.number ? `Cap. ${chapter.number}` : chapter.title}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {pages.length} páginas
                </p>
              </div>

              <button
                disabled={!payload.next_chapter}
                onClick={() => goToChapter(payload.next_chapter)}
                className="p-1.5 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                <ChevronRight size={20} className="text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
