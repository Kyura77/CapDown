import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, LayoutList, Loader2, Maximize2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client';

function useReaderMode() {
  useEffect(() => {
    document.body.classList.add('reader-mode');
    return () => document.body.classList.remove('reader-mode');
  }, []);
}

export default function ReaderView() {
  const { mangaId, chapterId } = useParams();
  const navigate = useNavigate();
  useReaderMode();

  const [readerPayload, setReaderPayload] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const [wide, setWide] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visibleCount, setVisibleCount] = useState(20);

  const scrollRef = useRef(null);
  const hudTimerRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.getReaderChapter(mangaId, chapterId)
      .then((res) => {
        if (!cancelled) {
          setVisibleCount(20);
          setProgress(0);
          if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
          }
          setReaderPayload(res.data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReaderPayload(null);
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId, mangaId]);

  useEffect(() => () => {
    window.clearTimeout(hudTimerRef.current);
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
    }
  }, []);

  const chapter = readerPayload?.chapter ?? null;
  const prevChapter = readerPayload?.prev_chapter ?? null;
  const nextChapter = readerPayload?.next_chapter ?? null;
  const pages = useMemo(() => {
    if (!chapter || !readerPayload?.pages?.length) {
      return [];
    }

    return readerPayload.pages.map((page) => (
      api.getTelegramPageUrl(chapter.id, page.index)
    ));
  }, [chapter, readerPayload]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    if (frameRef.current) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      const total = node.scrollHeight - node.clientHeight;
      setProgress(total > 0 ? Math.round((node.scrollTop / total) * 100) : 0);

      if (node.scrollTop + node.clientHeight >= node.scrollHeight - 1200 && visibleCount < pages.length) {
        setVisibleCount((current) => Math.min(current + 20, pages.length));
      }

      frameRef.current = null;
    });

    window.clearTimeout(hudTimerRef.current);
    setShowHud(true);
    hudTimerRef.current = window.setTimeout(() => setShowHud(false), 2600);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        navigate(-1);
      }
      if (event.key === 'ArrowLeft' && prevChapter) {
        navigate(`/reader/${mangaId}/${prevChapter.id}`);
      }
      if (event.key === 'ArrowRight' && nextChapter) {
        navigate(`/reader/${mangaId}/${nextChapter.id}`);
      }
      if (event.key.toLowerCase() === 'f') {
        setWide((value) => !value);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mangaId, navigate, nextChapter, prevChapter]);

  const isLoading = !loadError && !readerPayload;
  if (isLoading) {
    return (
      <div className="reader-root" style={{ display: 'grid', placeItems: 'center' }}>
        <p className="faint"><Loader2 size={16} className="spin" style={{ marginRight: 8 }} />Carregando capitulo...</p>
      </div>
    );
  }

  if (!chapter || !readerPayload || loadError) {
    return (
      <div className="reader-root" style={{ display: 'grid', placeItems: 'center' }}>
        <p className="faint">Capitulo nao encontrado.</p>
      </div>
    );
  }

  const visiblePages = pages.slice(0, visibleCount);

  return (
    <div className="reader-root" onClick={() => setShowHud((value) => !value)}>
      <div className="reader-progress"><div style={{ width: `${progress}%` }} /></div>

      <AnimatePresence>
        {showHud && (
          <motion.header
            className="reader-hud"
            initial={{ opacity: 0, y: -34 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -34 }}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Voltar">
              <ChevronLeft size={22} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {readerPayload.manga_title}
              </strong>
              <span className="small-text">{chapter.title}</span>
            </div>
            <button className="icon-btn" onClick={() => setWide((value) => !value)} aria-label="Alternar largura">
              {wide ? <LayoutList size={20} /> : <Maximize2 size={20} />}
            </button>
          </motion.header>
        )}
      </AnimatePresence>

      <div ref={scrollRef} className="reader-scroll" onScroll={handleScroll}>
        {visiblePages.map((url, index) => (
          <img
            key={url}
            src={url}
            loading={index < 3 ? 'eager' : 'lazy'}
            alt={`Pagina ${index + 1}`}
            className={`reader-page-img${wide ? ' wide' : ''}`}
          />
        ))}

        {pages.length > 0 && (
          <div className="stat-strip" onClick={(event) => event.stopPropagation()} style={{ padding: '28px 16px 56px', justifyContent: 'center' }}>
            <button className="btn" disabled={!prevChapter} onClick={() => prevChapter && navigate(`/reader/${mangaId}/${prevChapter.id}`)}>
              Capitulo anterior
            </button>
            <button className="btn btn-primary" disabled={!nextChapter} onClick={() => nextChapter && navigate(`/reader/${mangaId}/${nextChapter.id}`)}>
              Proximo capitulo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
