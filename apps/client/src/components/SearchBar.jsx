import React from 'react';
import { Filter, Loader2, Search, Sparkles, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function SearchBar({
  query, setQuery, onSearch, loading,
  mode, setMode, showFilters, setShowFilters,
  deepSearch, setDeepSearch,
  availableProviders = [], selectedProviders, toggleProvider,
  sortBy, setSortBy,
}) {
  return (
    <div className="search-wrap">
      <form className="search-box" onSubmit={onSearch}>
        <Search size={16} style={{ color: 'var(--txt3)', flexShrink: 0, marginLeft: 4 }} />
        <input
          className="search-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={mode === 'ai' ? 'Título, gênero ou URL...' : 'Título ou URL...'}
        />
        <button type="button"
          className={`btn btn-ghost btn-icon${showFilters ? ' text-green' : ''}`}
          onClick={() => setShowFilters(v => !v)}
          aria-label="Filtros"
        >
          <Filter size={16} />
        </button>
        <button type="submit" className="btn btn-primary"
          disabled={loading || !query.trim()}
          style={{ borderRadius: 12, minWidth: 90 }}
        >
          {loading ? <Loader2 size={16} className="spin" /> : 'Buscar'}
        </button>
      </form>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="search-filters">
              <div className="filter-row">
                <span className="filter-label">Modo</span>
                <div className="chips-row">
                  <button type="button" className={`chip${mode === 'ai' ? ' on' : ''}`} onClick={() => setMode('ai')}>
                    <Sparkles size={11} /> AI
                  </button>
                  <button type="button" className={`chip${mode === 'classic' ? ' on' : ''}`} onClick={() => setMode('classic')}>
                    Manual
                  </button>
                  <button type="button" className={`chip${deepSearch ? ' on' : ''}`} onClick={() => setDeepSearch(v => !v)}>
                    <Zap size={11} /> Deep
                  </button>
                </div>
              </div>

              <div className="filter-row">
                <span className="filter-label">Ordenar</span>
                <div className="chips-row">
                  <button type="button" className={`chip${sortBy === 'relevance' ? ' on' : ''}`} onClick={() => setSortBy('relevance')}>Relevância</button>
                  <button type="button" className={`chip${sortBy === 'chapters' ? ' on' : ''}`} onClick={() => setSortBy('chapters')}>Capítulos</button>
                </div>
              </div>

              {availableProviders.length > 0 && (
                <div className="filter-row">
                  <span className="filter-label">Provedores</span>
                  <div className="chips-row">
                    {availableProviders.map(p => (
                      <button key={p.id} type="button"
                        className={`chip${selectedProviders.includes(p.id) ? ' on' : ''}`}
                        onClick={() => toggleProvider(p.id)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
