import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, Loader2, Search, SlidersHorizontal, Sparkles, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLibrary } from '../context/LibraryContext';
import { useDownloads } from '../context/DownloadsContext';
import { useProviderCatalog } from '../hooks/useProviderCatalog';
import { useToast } from '../components/Toast';

const PLACEHOLDER = 'https://placehold.co/400x600/10130f/62a33c?text=Cap';

function MangaCardNew({ item, onClick, onDelete }) {
  const [imgErr, setImgErr] = useState(false);
  const cover = imgErr ? PLACEHOLDER : (item?.cover_url || PLACEHOLDER);
  const chapters = item?.chapters ?? item?.sources?.[0]?.total_chapters;
  const chapterCount = typeof chapters === 'number' ? chapters : (Array.isArray(chapters) ? chapters.length : null);

  return (
    <motion.div
      className="relative group cursor-pointer rounded-xl overflow-hidden bg-[var(--color-surface)]"
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] overflow-hidden">
        <img
          src={cover}
          alt={item?.title}
          onError={() => setImgErr(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {/* Download button on hover */}
        {!onDelete && (
          <motion.div
            className="absolute inset-0 flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <span className="glass text-xs text-brand-400 px-3 py-1.5 rounded-full font-medium">
              Ver detalhes
            </span>
          </motion.div>
        )}
        {/* Delete button */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
          >
            <X size={13} />
          </button>
        )}
        {/* Chapter badge */}
        {chapterCount != null && (
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-xs text-brand-400 px-2 py-0.5 rounded-full font-medium">
            {chapterCount} caps
          </div>
        )}
      </div>
      {/* Title */}
      <div className="p-2.5">
        <p className="text-xs font-semibold text-[var(--color-text-primary)] leading-snug line-clamp-2">{item?.title}</p>
      </div>
    </motion.div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-[var(--color-surface)] animate-pulse">
      <div className="aspect-[2/3] bg-[var(--color-surface-border)]" />
      <div className="p-2.5 space-y-1.5">
        <div className="h-2.5 bg-[var(--color-surface-border)] rounded w-4/5" />
        <div className="h-2.5 bg-[var(--color-surface-border)] rounded w-3/5" />
      </div>
    </div>
  );
}

function SelectionView({ selection, onBack, onDownload }) {
  const [visibleChs, setVisibleChs] = useState(80);
  const chapters = selection?.chapters ?? [];
  const visible = chapters.slice(0, visibleChs);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      {/* Back bar */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--color-surface-border)]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors"
        >
          <X size={16} /> Fechar
        </button>
      </div>

      {/* Hero */}
      <div className="flex gap-5 p-5 border-b border-[var(--color-surface-border)]">
        <img
          src={selection.cover_url || PLACEHOLDER}
          alt={selection.title}
          className="w-28 rounded-xl shadow-2xl shrink-0 border border-[var(--color-surface-border)]"
          onError={e => { e.currentTarget.src = PLACEHOLDER; }}
        />
        <div className="flex flex-col justify-center gap-3">
          <h2 className="text-xl font-bold text-white leading-tight">{selection.title}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{chapters.length} capítulos disponíveis</p>
          <motion.button
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors w-fit"
            whileTap={{ scale: 0.95 }}
            onClick={() => onDownload()}
          >
            <Download size={15} /> Baixar obra inteira
          </motion.button>
        </div>
      </div>

      {/* Chapter list */}
      <div className="p-4">
        <p className="text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider mb-3">
          {chapters.length} Capítulos
        </p>
        <div className="space-y-1">
          {visible.map(ch => (
            <motion.button
              key={ch.source_id}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors text-left group"
              whileTap={{ scale: 0.98 }}
              onClick={() => onDownload(ch)}
            >
              <span className="text-xs font-bold text-brand-500 w-8 shrink-0">#{ch.number ?? '?'}</span>
              <span className="text-sm text-[var(--color-text-primary)] flex-1 line-clamp-1">{ch.title}</span>
              <Download size={14} className="text-[var(--color-text-muted)] group-hover:text-brand-400 transition-colors shrink-0" />
            </motion.button>
          ))}
        </div>
        {visibleChs < chapters.length && (
          <button
            className="w-full mt-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors"
            onClick={() => setVisibleChs(v => Math.min(v + 80, chapters.length))}
          >
            Carregar mais ({chapters.length - visibleChs} restantes)
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { library, loading: libLoading, error: libError, refreshLibrary } = useLibrary();
  const { downloads, refreshDownloads } = useDownloads();
  const { providers: availableProviders } = useProviderCatalog();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState(() => localStorage.getItem('capdown:use_ai') === 'false' ? 'classic' : 'ai');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProviders, setProviders] = useState([]);
  const [deepSearch, setDeepSearch] = useState(true);
  const [selection, setSelection] = useState(null);
  const [selLoading, setSelLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [globalEnabledProviders, setGlobalEnabledProviders] = useState([]);

  useEffect(() => {
    api.getSettings().then(r => {
      setGlobalEnabledProviders(r.data.enabled_providers || []);
    }).catch(console.error);
  }, []);

  const mangaList = useMemo(() => library?.manga ?? [], [library]);
  const activeJobs = useMemo(() => (downloads ?? []).filter(j => ['queued', 'downloading', 'failed'].includes(j.status)), [downloads]);
  const filteredLib = useMemo(() =>
    filter === 'all' ? mangaList : mangaList.filter(m => (m.media_type ?? 'manga') === filter),
    [mangaList, filter]
  );

  const filteredProviders = useMemo(() => {
    const enabled = availableProviders.filter(p => p.status === 'enabled');
    if (globalEnabledProviders.length === 0) return enabled;
    return enabled.filter(p => globalEnabledProviders.includes(p.id));
  }, [availableProviders, globalEnabledProviders]);

  const toggleProvider = id => setProviders(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleSearch = useCallback(async e => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true); setResults([]); setSelection(null);
    try {
      const params = { deep: deepSearch, ...(selectedProviders.length ? { providers: selectedProviders.join(',') } : {}) };
      let data;
      if (q.startsWith('http')) {
        const r = await api.preview(q);
        setSelection(r.data); return;
      } else if (mode === 'ai') {
        const r = await api.searchAi(q, params);
        data = r.data.results ?? r.data ?? [];
      } else {
        const r = await api.search(q, params);
        data = r.data ?? [];
      }
      setResults(data);
    } catch (err) {
      toast({ title: 'Erro na busca', desc: err?.response?.data?.error ?? err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [query, mode, deepSearch, selectedProviders, toast]);

  const handlePreview = async source => {
    setSelLoading(true); setSelection(null);
    try {
      const r = await api.preview(source.source_url);
      setSelection(r.data);
    } catch {
      toast({ title: 'Erro', desc: 'Falha ao carregar detalhes da fonte.', type: 'error' });
    } finally { setSelLoading(false); }
  };

  const handleDownload = async (chapter = null) => {
    if (!selection) return;
    try {
      await api.createDownload({
        url: selection.source_url,
        concurrency: 8,
        ...(chapter ? { chapters: [chapter.source_id] } : {}),
      });
      refreshDownloads();
      toast({ title: 'Download iniciado!', desc: selection.title, type: 'success' });
    } catch (err) {
      toast({ title: 'Erro', desc: err?.response?.data?.error ?? 'Falha ao iniciar download.', type: 'error' });
    }
  };

  const handleDelete = async (e, manga) => {
    e.stopPropagation();
    if (!confirm(`Excluir "${manga.title}"?`)) return;
    try {
      await api.deleteManga(manga.id);
      await refreshLibrary();
      toast({ title: 'Removido', desc: manga.title, type: 'success' });
    } catch {
      toast({ title: 'Erro', desc: 'Não foi possível excluir.', type: 'error' });
    }
  };

  // --- Selection View ---
  if (selection) {
    return (
      <AnimatePresence mode="wait">
        <SelectionView
          key="selection"
          selection={selection}
          onBack={() => setSelection(null)}
          onDownload={handleDownload}
        />
      </AnimatePresence>
    );
  }

  // --- Main View ---
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">

      {/* Hero Section */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-brand-400 font-bold tracking-widest uppercase">CapDown</span>
          <div className="h-px flex-1 bg-gradient-to-r from-brand-500/30 to-transparent" />
        </div>
        <h1 className="text-3xl font-black text-white leading-tight mb-1">
          Sua banca<br />
          <span className="text-brand-400">infinita.</span>
        </h1>

        {/* Stats Row */}
        <div className="flex gap-4 mt-4">
          {[
            { val: mangaList.length, lbl: 'Obras' },
            { val: downloads.length, lbl: 'Downloads' },
            { val: activeJobs.length, lbl: 'Ativos' },
          ].map(s => (
            <div key={s.lbl} className="flex flex-col items-center px-3 py-2 bg-[var(--color-surface)] rounded-xl">
              <span className="text-lg font-black text-brand-400 leading-none">{s.val}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">{s.lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 pb-3">
        <form onSubmit={handleSearch} className="relative">
          <div className="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-surface-border)] rounded-2xl px-4 py-3 focus-within:border-brand-500/60 transition-colors">
            <Search size={17} className="text-[var(--color-text-muted)] shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar mangá ou colar URL..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-[var(--color-text-muted)] outline-none"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); setResults([]); }}>
                <X size={15} className="text-[var(--color-text-muted)] hover:text-white" />
              </button>
            )}
          </div>

          {/* Mode & Filter toggles */}
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => setMode(m => m === 'ai' ? 'classic' : 'ai')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${mode === 'ai' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-surface-border)]'}`}
            >
              <Sparkles size={11} />
              {mode === 'ai' ? 'IA Ativa' : 'Modo Clássico'}
            </button>
            <button
              type="button"
              onClick={() => setDeepSearch(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${deepSearch ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-surface-border)]'}`}
            >
              <Zap size={11} />
              Busca profunda
            </button>
            {filteredProviders.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFilters(v => !v)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-surface-border)] transition-colors ml-auto"
              >
                <SlidersHorizontal size={11} />
                Fontes {selectedProviders.length > 0 && `(${selectedProviders.length})`}
              </button>
            )}
          </div>

          {/* Provider filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 pt-3">
                  {filteredProviders.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProvider(p.id)}
                      className={`text-xs px-3 py-1.5 rounded-full transition-colors ${selectedProviders.includes(p.id) ? 'bg-brand-500 text-white border-brand-500' : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-surface-border)]'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>

      {/* Search Results */}
      <AnimatePresence>
        {(loading || results.length > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                {loading ? 'Buscando...' : `${results.length} resultados`}
              </span>
              {results.length > 0 && (
                <button onClick={() => setResults([])} className="text-xs text-[var(--color-text-muted)] hover:text-white flex items-center gap-1">
                  <X size={12} /> Limpar
                </button>
              )}
            </div>

            {selLoading && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-brand-400" />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {loading
                ? Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)
                : results.map((item, i) => (
                  <MangaCardNew
                    key={i}
                    item={item}
                    onClick={() => item.sources?.[0] && handlePreview(item.sources[0])}
                  />
                ))
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Library */}
      {results.length === 0 && !loading && (
        <div className="px-4 pb-24">
          {/* Filter tabs */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Biblioteca</span>
            <div className="flex gap-1">
              {[{ id: 'all', label: 'Todos' }, { id: 'manga', label: 'Mangá' }, { id: 'novel', label: 'Novel' }].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${filter === f.id ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-[var(--color-text-muted)]'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {libLoading && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          )}

          {!libLoading && libError && (
            <div className="flex flex-col items-center py-16 text-red-400 gap-3">
              <span className="text-4xl">⚠</span>
              <p className="text-sm text-center">Falha ao carregar biblioteca</p>
            </div>
          )}

          {!libLoading && !libError && filteredLib.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center">
                <BookOpen size={28} className="text-[var(--color-text-muted)]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Acervo vazio</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Busque uma obra acima para começar.</p>
              </div>
            </div>
          )}

          {!libLoading && !libError && filteredLib.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filteredLib.map(manga => (
                <MangaCardNew
                  key={manga.id}
                  item={manga}
                  onClick={() => navigate(`/manga/${manga.id}`)}
                  onDelete={e => handleDelete(e, manga)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
