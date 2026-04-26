import React, { useCallback, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Download, Filter, Loader2, Search, Sparkles, Trash2, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { buildProviderLookup, getProviderLabel } from '../api/providers';
import { useLibrary } from '../context/LibraryContext';
import { useDownloads } from '../context/DownloadsContext';
import { useProviderCatalog } from '../hooks/useProviderCatalog';
import { SearchBar } from '../components/SearchBar';
import { MediaCard } from '../components/MediaCard';

const PLACEHOLDER = 'https://placehold.co/400x600/10120f/bcff4d?text=CapDown';
const ITEMS_PER_PAGE = 12;

function extractApiError(error, fallback) {
  const raw = error?.response?.data;
  const message = typeof raw === 'string'
    ? raw
    : typeof raw?.error === 'string'
      ? raw.error
      : typeof raw?.message === 'string'
        ? raw.message
        : null;

  if (!message) return fallback;
  return message.replace('verdinha_auth_required:', '').trim();
}

function ResultCard({ result, onSelect, formatProvider }) {
  return (
    <motion.article
      layout
      className="result-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      whileHover={{ y: -2 }}
    >
      <img src={result.cover_url || PLACEHOLDER} alt={result.title} onError={(event) => { event.currentTarget.src = PLACEHOLDER; }} />
      <div style={{ minWidth: 0 }}>
        <h3 className="manga-title">{result.title}</h3>
        {result.description && <p className="small-text line-clamp">{result.description}</p>}
        <div className="chip-row" style={{ marginTop: 12 }}>
          {result.sources.map((source) => (
            <button key={`${source.provider_id}-${source.source_url}`} className="chip" onClick={() => onSelect(source)}>
              <Download size={13} />
              {formatProvider(source.provider_id)}
            </button>
          ))}
        </div>
      </div>
    </motion.article>
  );
}

function JobCard({ job, onCancel }) {
  const progress = Math.round((job.downloaded_chapters / (job.total_chapters || 1)) * 100);

  return (
    <article className="download-row">
      <div className="chapter-number">
        {job.status === 'downloading' ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.manga_title || 'Preparando download'}
        </strong>
        <p className="small-text">
          {job.current_chapter || job.status}
          {job.total_pages > 0 ? ` · ${job.downloaded_pages}/${job.total_pages} paginas` : ''}
        </p>
        <div className="progress-track" style={{ marginTop: 8 }}>
          <motion.div className="progress-fill" animate={{ width: `${progress}%` }} />
        </div>
      </div>
      <button className="icon-btn" onClick={() => onCancel(job.id)} aria-label="Cancelar download">
        <X size={18} />
      </button>
    </article>
  );
}

export default function Dashboard() {
  const { library, loading: libraryLoading, refreshLibrary } = useLibrary();
  const { downloads, refreshDownloads } = useDownloads();
  const { providers: availableProviders, loading: providersLoading } = useProviderCatalog();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState(() => (localStorage.getItem('capdown:use_ai') === 'false' ? 'classic' : 'ai'));
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [selection, setSelection] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [sortBy, setSortBy] = useState('relevance');
  const [deepSearch, setDeepSearch] = useState(true);
  const [visibleSelectionChapters, setVisibleSelectionChapters] = useState(80);
  const [mediaFilter, setMediaFilter] = useState('all'); // all, manga, novel

  const mangaList = (library?.manga || []).filter(item => {
    if (mediaFilter === 'all') return true;
    return (item.media_type || 'manga') === mediaFilter;
  });
  const activeJobs = (downloads || []).filter((job) =>
    job.status === 'queued' || job.status === 'downloading' || job.status === 'failed'
  );
  const providerLookup = useMemo(() => buildProviderLookup(availableProviders), [availableProviders]);
  const selectedChapters = useMemo(() => selection?.manga?.chapters || [], [selection]);
  const visibleSelectionList = useMemo(
    () => selectedChapters.slice(0, visibleSelectionChapters),
    [selectedChapters, visibleSelectionChapters],
  );
  const pageCount = Math.max(1, Math.ceil(results.length / ITEMS_PER_PAGE));
  const visibleResults = useMemo(
    () => results.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [currentPage, results]
  );
  const concurrency = Number(localStorage.getItem('capdown:concurrency') || 8);
  const selectedProviderIds = useMemo(
    () => selectedProviders.filter((providerId) => providerLookup.has(providerId)),
    [providerLookup, selectedProviders],
  );
  const providerParam = selectedProviderIds.length > 0 ? selectedProviderIds.join(',') : undefined;
  const formatProvider = useCallback(
    (providerId) => getProviderLabel(providerId, providerLookup),
    [providerLookup],
  );

  const toggleProvider = (id) => {
    setSelectedProviders((prev) => prev.includes(id) ? prev.filter((provider) => provider !== id) : [...prev, id]);
  };

  const handleSearch = useCallback(async (event) => {
    event?.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setAnalysis(null);
    setSelection(null);
    setCurrentPage(1);
    setVisibleSelectionChapters(80);

    const params = { deep: deepSearch, ...(providerParam ? { providers: providerParam } : {}) };

    try {
      if (q.startsWith('http')) {
        const res = await api.preview(q);
        setResults([{
          title: res.data.title,
          cover_url: res.data.cover_url,
          sources: [{ provider_id: res.data.provider_id, source_url: res.data.source_url }],
        }]);
      } else if (mode === 'ai') {
        const res = await api.searchAi(q, params);
        const finalResults = res.data.results || [];
        if (sortBy === 'chapters') {
          finalResults.sort((a, b) => Math.max(...b.sources.map((s) => s.total_chapters || 0)) - Math.max(...a.sources.map((s) => s.total_chapters || 0)));
        }
        setResults(finalResults);
        setAnalysis(res.data.analysis || null);
      } else {
        const res = await api.search(q, params);
        const finalResults = res.data || [];
        if (sortBy === 'chapters') {
          finalResults.sort((a, b) => Math.max(...b.sources.map((s) => s.total_chapters || 0)) - Math.max(...a.sources.map((s) => s.total_chapters || 0)));
        }
        setResults(finalResults);
      }
    } catch (err) {
      setError(extractApiError(err, 'Nao foi possivel concluir a busca.'));
    } finally {
      setLoading(false);
    }
  }, [deepSearch, mode, providerParam, query, sortBy]);

  const handleSelectSource = async (source) => {
    setError(null);
    try {
      const res = await api.preview(source.source_url);
      setSelection({ source, manga: res.data });
      setVisibleSelectionChapters(80);
    } catch (err) {
      setError(extractApiError(err, 'Falha ao abrir selecao desta fonte.'));
    }
  };

  const handleDownload = async (chapter = null) => {
    if (!selection) return;
    try {
      await api.createDownload({
        url: selection.manga.source_url,
        concurrency,
        ...(chapter ? { chapters: [chapter.source_id] } : {}),
      });
      refreshDownloads();
    } catch (err) {
      setError(extractApiError(err, 'Falha ao iniciar download.'));
    }
  };

  const handleDeleteManga = async (event, manga) => {
    event.stopPropagation();
    if (!window.confirm(`Excluir "${manga.title}"?`)) return;
    try {
      await api.deleteManga(manga.id);
      await refreshLibrary();
    } catch {
      alert('Erro ao excluir.');
    }
  };

  const handleCancelDownload = async (id) => {
    try {
      await api.deleteDownload(id);
      refreshDownloads();
    } catch {
      alert('Erro ao cancelar.');
    }
  };

  return (
    <div className="page">
      <section className="hero-grid">
        <motion.div className="hero-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <span className="eyebrow">CapDown offline vault</span>
            <h1 className="page-title">Sua banca infinita.</h1>
            <p className="page-subtitle">Busca, baixa e organiza caps para ler quando quiser, com armazenamento local ou Telegram.</p>
          </div>
          <div className="stat-strip">
            <div className="stat-pill"><strong>{mangaList.length}</strong><span>obras</span></div>
            <div className="stat-pill"><strong>{downloads.length}</strong><span>jobs</span></div>
            <div className="stat-pill"><strong>{activeJobs.length}</strong><span>ativos</span></div>
          </div>
        </motion.div>

        <aside className="side-stack">
          <div className="panel">
            <div className="panel-title">
              <span>Fila ativa</span>
              <Link to="/downloads" className="faint">Ver tudo</Link>
            </div>
            <div className="download-list">
              {activeJobs.slice(0, 3).map((job) => <JobCard key={job.id} job={job} onCancel={handleCancelDownload} />)}
              {activeJobs.length === 0 && <div className="empty-state">Nenhum download rodando.</div>}
            </div>
          </div>
        </aside>
      </section>

      <SearchBar 
        query={query}
        setQuery={setQuery}
        onSearch={handleSearch}
        loading={loading}
        mode={mode}
        setMode={setMode}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        deepSearch={deepSearch}
        setDeepSearch={setDeepSearch}
        availableProviders={availableProviders}
        selectedProviders={selectedProviders}
        toggleProvider={toggleProvider}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      <AnimatePresence>
        {error && (
          <motion.div className="error-banner" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {results.length > 0 && (
        <section id="results-section">
          <div className="section-head">
            <div>
              <h2>Resultados</h2>
              {analysis && <p className="small-text">{analysis.interpretation}</p>}
            </div>
            <button className="btn" onClick={() => setResults([])}>Limpar</button>
          </div>
          <div className="grid-results">
            {visibleResults.map((result, index) => (
              <ResultCard key={`${result.title}-${index}`} result={result} onSelect={handleSelectSource} formatProvider={formatProvider} />
            ))}
          </div>
          {pageCount > 1 && (
            <div className="stat-strip" style={{ justifyContent: 'center' }}>
              <button className="btn" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Anterior</button>
              <div className="stat-pill"><strong>{currentPage}</strong><span>de {pageCount}</span></div>
              <button className="btn" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}>Proxima</button>
            </div>
          )}
        </section>
      )}

      {selection && (
        <section>
          <div className="section-head">
            <h2>Selecionar download</h2>
            <button className="icon-btn" onClick={() => setSelection(null)} aria-label="Fechar selecao"><X size={18} /></button>
          </div>
          <div className="panel">
            <div className="result-card" style={{ boxShadow: 'none' }}>
              <img src={selection.manga.cover_url || PLACEHOLDER} alt={selection.manga.title} />
              <div>
                <span className="chip">{formatProvider(selection.source.provider_id)}</span>
                <h3 style={{ margin: '12px 0 4px' }}>{selection.manga.title}</h3>
                <p className="small-text">{selectedChapters.length} capitulos encontrados</p>
                <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => handleDownload()}>
                  <Download size={18} />
                  Baixar obra inteira
                </button>
              </div>
            </div>
            <div className="chapter-list" style={{ maxHeight: 340, overflow: 'auto', marginTop: 14 }}>
              {visibleSelectionList.map((chapter) => (
                <button key={chapter.source_id} className="chapter-row" onClick={() => handleDownload(chapter)}>
                  <span className="chapter-number">{chapter.number || '?'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chapter.title}</span>
                  <Download size={18} />
                </button>
              ))}
            </div>
            {visibleSelectionChapters < selectedChapters.length && (
              <div className="stat-strip" style={{ marginTop: 14, justifyContent: 'center' }}>
                <button
                  className="btn"
                  onClick={() => setVisibleSelectionChapters((current) => Math.min(current + 80, selectedChapters.length))}
                >
                  Mostrar mais capitulos
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <div className="section-head" style={{ marginBottom: 24 }}>
          <h2>Biblioteca</h2>
          <div className="chip-row" style={{ background: 'var(--panel)', padding: 4, borderRadius: 99 }}>
            <button className={`chip-glass ${mediaFilter === 'all' ? 'active' : ''}`} onClick={() => setMediaFilter('all')}>Todos</button>
            <button className={`chip-glass ${mediaFilter === 'manga' ? 'active' : ''}`} onClick={() => setMediaFilter('manga')}>Mangás</button>
            <button className={`chip-glass ${mediaFilter === 'novel' ? 'active' : ''}`} onClick={() => setMediaFilter('novel')}>Novels</button>
          </div>
        </div>
        {mangaList.length === 0 ? (
          <div className="empty-state">
            <div>
              <BookOpen size={36} style={{ margin: '0 auto 10px' }} />
              <p>{libraryLoading ? 'Carregando biblioteca...' : 'Nada salvo ainda.'}</p>
            </div>
          </div>
        ) : (
          <div className="grid-results">
            {mangaList.map((manga) => (
              <MediaCard 
                key={manga.id} 
                item={manga} 
                onClick={() => navigate(`/manga/${manga.id}`)} 
                onDelete={(item) => handleDeleteManga({ stopPropagation: () => {} }, item)} 
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
