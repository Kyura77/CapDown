import React from 'react';
import { motion } from 'framer-motion';

const PLACEHOLDER = 'https://placehold.co/400x600/10120f/bcff4d?text=CapDown';

export function MediaCard({ item, onClick, onDelete }) {
  const isNovel = item.media_type === 'novel';
  const coverUrl = item.cover_url || PLACEHOLDER;

  return (
    <motion.div 
      className="media-card"
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={onClick}
    >
      <div className="media-cover-container">
        {onDelete && (
          <button 
            className="delete-btn" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            aria-label="Delete media"
          >
            ✕
          </button>
        )}
        
        <img 
          src={coverUrl} 
          alt={item.title} 
          className="media-cover" 
          onError={(e) => { e.currentTarget.src = PLACEHOLDER; }} 
        />
        
        <div className="media-overlay" />
        
        <div className="media-badge">
          {isNovel ? 'NOVEL' : 'MANGA'}
        </div>
        
        {item.rating && (
          <div className="media-rating">
            {item.rating}
          </div>
        )}
      </div>
      
      <div className="media-info">
        <h3 className="media-title">{item.title}</h3>
        <p className="media-meta">
          {item.chapters?.length || 0} {isNovel ? 'parts' : 'caps'}
        </p>
      </div>
    </motion.div>
  );
}
