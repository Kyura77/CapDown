import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Play, RefreshCw, Send, ShieldAlert, Trash2, Loader2, BookMarked } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client';
import { useLibrary } from '../context/LibraryContext';

const PLACEHOLDER = 'https://placehold.co/500x750/10130f/62a33c?text=Cap';
const fmt = id => (id ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const initialState = {
  detail: null,
  error: null,
  loading: true,
  deleting: false,
  auditing: false,
  issues: [],
  preparingTg: false,
  coverErr: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'FETCH_START': return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS': return { ...state, loading: false, detail: action.payload, error: null };
    case 'FETCH_ERROR': return { ...state, loading: false, detail: null, error: action.payload };
    case 'SET_DELETING': return { ...state, deleting: action.payload };
    case 'SET_AUDITING': return { ...state, auditing: action.payload };
    case 'SET_ISSUES': return { ...state, issues: action.payload };
    case 'SET_PREPARING_TG': return { ...state, preparingTg: action.payload };
    case 'SET_COVER_ERR': return { ...state, coverErr: action.payload };
    case 'SET_DETAIL': return { ...state, detail: action.payload };
    default: return state;
  }
}

export default function MangaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { library, refreshLibrary } = useLibrary();

  const [state, dispatch] = useReducer(reducer, initialState);
  const [search, setSearch] = useState('');

  const manga = state.detail ?? library?.manga?.find(m => m.id === id);
  const cover = state.coverErr ? PLACEHOLDER : (manga?.cover_url ?? PLACEHOLDER);

  const chapters = useMemo(() =>
    manga ? [...manga.chapters].sort((a, b) => parseFloat(b.number ?? 0) - parseFloat(a.number ?? 0)) : [],
    [manga]
  );

  const filteredChapters = useMemo(() =>
    search.trim() ? chapters.filter(c => c.title?.toLowerCase().includes(search.toLowerCase()) || String(c.number).includes(search)) : chapters,
    [chapters, search]
  );

  useEffect(() => {
    let alive = true;
    dispatch({ type: 'FETCH_START' });
    
    api.getManga(id)
      .then(r => { if (alive) dispatch({ type: 'FETCH_SUCCESS', payload: r.data }) })
      .catch(err => { if (alive) dispatch({ type: 'FETCH_ERROR', payload: err }) });
      
    return () => { alive = false; };
  }, [id]);

  if (state.loading && !manga) return (
    <div className="flex items-center justify-center h-[60vh] flex-col gap-3">
      <Loader2 size={32} className="animate-spin text-brand-400" />
      <p className="text-sm text-[var(--color-text-muted)]">Carregando obra...</p>
    </div>
  );

  if (state.error) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
      <span className="text-5xl">⚠️</span>
      <p className="text-red-400 text-sm text-center px-8">Falha ao carregar a obra.</p>
    </div>
  );

  if (!manga) return (
    <div className="flex items-center justify-center h-[60vh]">
      <p className="text-[var(--color-text-muted)] text-sm">Obra não encontrada.</p>
    </div>
  );

  const handleDelete = async () => {
    if (!confirm(`Excluir "${manga.title}"?`)) return;
    dispatch({ type: 'SET_DELETING', payload: true });
    try {
      await api.deleteManga(id);
      await refreshLibrary?.();
      navigate('/');
    } catch {
      alert('Erro ao excluir.');
      dispatch({ type: 'SET_DELETING', payload: false });
    }
  };

  const handleAudit = async () => {
    dispatch({ type: 'SET_AUDITING', payload: true });
    try {
      const r = await api.auditManga(id);
      dispatch({ type: 'SET_ISSUES', payload: r.data.discrepancies ?? [] });
    } catch { 
      dispatch({ type: 'SET_ISSUES', payload: [] });
    }
    finally { dispatch({ type: 'SET_AUDITING', payload: false }); }
  };

  const handleTelegram = async () => {
    dispatch({ type: 'SET_PREPARING_TG', payload: true });
    try {
      const r = await api.prepareMangaTelegram(id);
      await refreshLibrary?.();
      const d = await api.getManga(id); 
      dispatch({ type: 'SET_DETAIL', payload: d.data });
      alert(r.data.failed_pages?.length ? `Telegram preparado com ${r.data.failed_pages.length} falha(s).` : 'Pronto!');
    } catch { 
      alert('Falha ao preparar para o Telegram.'); 
    }
    finally { dispatch({ type: 'SET_PREPARING_TG', payload: false }); }
  };

  const firstChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
      {/* Ambient blurred background */}
      <div
        className="fixed inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url(${cover})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(60px)',
          zIndex: 0,
        }}
      />

      <div className="relative z-10">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-surface-border)]">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors"
          >
            <ChevronLeft size={18} /> Voltar
          </button>
          <button
            onClick={handleDelete}
            disabled={state.deleting}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            {state.deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Excluir
          </button>
        </div>

        {/* Hero section */}
        <div className="flex gap-5 px-5 py-6 border-b border-[var(--color-surface-border)]">
          <motion.img
            src={cover}
            alt={manga.title}
            onError={() => dispatch({ type: 'SET_COVER_ERR', payload: true })}
            className="w-28 rounded-xl shadow-2xl border border-[var(--color-surface-border)] shrink-0 object-cover"
            style={{ aspectRatio: '2/3' }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          />

          <motion.div
            className="flex flex-col justify-center gap-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            {manga.provider_id && (
              <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">{fmt(manga.provider_id)}</span>
            )}
            <h1 className="text-xl font-black text-white leading-tight">{manga.title}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">{chapters.length} capítulos</p>

            {/* Read button */}
            {firstChapter && (
              <motion.button
                className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors w-fit mt-1"
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/reader/${manga.id}/${firstChapter.id}`)}
              >
                <Play size={14} /> Ler do início
              </motion.button>
            )}
          </motion.div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-b border-[var(--color-surface-border)] overflow-x-auto">
          <ActionButton
            icon={state.preparingTg ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            label="Telegram"
            onClick={handleTelegram}
            disabled={state.preparingTg || !chapters.length}
          />
          <ActionButton
            icon={state.auditing ? <RefreshCw size={13} className="animate-spin" /> : <ShieldAlert size={13} />}
            label="Auditar"
            onClick={handleAudit}
            disabled={state.auditing}
          />
          {state.issues.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 shrink-0">
              <AlertCircle size={13} />
              {state.issues.length} capítulo(s) com problema
            </div>
          )}
        </div>

        {/* Chapter list */}
        <div className="px-4 py-4 pb-24">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <BookMarked size={13} /> Capítulos
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">{filteredChapters.length} de {chapters.length}</span>
          </div>

          {/* Search within chapters */}
          {chapters.length > 12 && (
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar capítulo..."
              className="w-full mb-3 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-surface-border)] rounded-xl text-sm text-white placeholder:text-[var(--color-text-muted)] outline-none focus:border-brand-500/50 transition-colors"
            />
          )}

          <AnimatePresence initial={false}>
            <div className="space-y-1">
              {filteredChapters.map((ch, i) => {
                const hasIssue = state.issues.some(iss => iss.chapter_id === ch.id);
                return (
                  <motion.button
                    key={ch.id}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors text-left group"
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.01, 0.3) }}
                    onClick={() => navigate(`/reader/${manga.id}/${ch.id}`)}
                  >
                    <span className="text-xs font-black text-brand-500 w-9 shrink-0 text-center">
                      {ch.number ?? '?'}
                    </span>
                    <span className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm text-white line-clamp-1">{ch.title}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {ch.page_count ?? ch.pages?.length ?? 0} páginas
                      </span>
                    </span>
                    {hasIssue
                      ? <AlertCircle size={15} className="text-red-400 shrink-0" />
                      : <Play size={14} className="text-[var(--color-text-muted)] group-hover:text-brand-400 transition-colors shrink-0" />
                    }
                  </motion.button>
                );
              })}
            </div>
          </AnimatePresence>

          {filteredChapters.length === 0 && (
            <p className="text-center text-sm text-[var(--color-text-muted)] py-8">Nenhum capítulo encontrado.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({ icon, label, onClick, disabled }) {
  return (
    <motion.button
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-white hover:border-brand-500/40 transition-colors disabled:opacity-50 shrink-0"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
    >
      {icon} {label}
    </motion.button>
  );
}