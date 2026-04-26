import React from 'react';
import { Search, Filter, Loader2, Sparkles, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function SearchBar({ 
  query, 
  setQuery, 
  onSearch, 
  loading, 
  mode, 
  setMode, 
  showFilters, 
  setShowFilters,
  deepSearch,
  setDeepSearch,
  availableProviders,
  selectedProviders,
  toggleProvider,
  sortBy,
  setSortBy
}) {
  return (
    <div className="search-surface-glass">
      <form className="search-row-glass" onSubmit={onSearch}>
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            className="search-input-glass"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'ai' ? 'Search by title, genre, or paste a URL...' : 'Title or URL...'}
          />
        </div>
        
        <button 
          type="button" 
          className={`icon-btn-glass ${showFilters ? 'active' : ''}`} 
          onClick={() => setShowFilters(!showFilters)} 
          aria-label="Filters"
        >
          <Filter size={20} />
        </button>
        
        <button className="btn-glass-primary" disabled={loading || !query.trim()}>
          {loading ? <Loader2 size={18} className="spin" /> : 'Search'}
        </button>
      </form>

      <AnimatePresence>
        {showFilters && (
          <motion.div 
            className="filters-grid-glass"
            initial={{ opacity: 0, height: 0, marginTop: 0 }} 
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }} 
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
          >
            <div className="filter-group">
              <p className="filter-label">Mode</p>
              <div className="chip-row">
                <button type="button" className={`chip-glass ${mode === 'ai' ? 'active' : ''}`} onClick={() => setMode('ai')}>
                  <Sparkles size={13} /> AI
                </button>
                <button type="button" className={`chip-glass ${mode === 'classic' ? 'active' : ''}`} onClick={() => setMode('classic')}>
                  Manual
                </button>
                <button type="button" className={`chip-glass ${deepSearch ? 'active' : ''}`} onClick={() => setDeepSearch(!deepSearch)}>
                  <Zap size={13} /> Deep
                </button>
              </div>
            </div>
            
            <div className="filter-group">
              <p className="filter-label">Sort</p>
              <div className="chip-row">
                <button type="button" className={`chip-glass ${sortBy === 'relevance' ? 'active' : ''}`} onClick={() => setSortBy('relevance')}>
                  Relevance
                </button>
                <button type="button" className={`chip-glass ${sortBy === 'chapters' ? 'active' : ''}`} onClick={() => setSortBy('chapters')}>
                  Chapters
                </button>
              </div>
            </div>
            
            <div className="filter-group">
              <p className="filter-label">Providers</p>
              <div className="chip-row">
                {availableProviders.length === 0 ? (
                  <span className="small-text" style={{ color: 'var(--text-muted)' }}>No providers available.</span>
                ) : (
                  availableProviders.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      className={`chip-glass ${selectedProviders.includes(provider.id) ? 'active' : ''}`}
                      onClick={() => toggleProvider(provider.id)}
                    >
                      {provider.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
