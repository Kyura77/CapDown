import React from 'react';
import { motion } from 'framer-motion';

const COVER_FALLBACK = 'https://placehold.co/400x600/0d0d0f/b8ff4a?text=Cap';

export function MediaCard({ item, onClick, onDelete }) {
  const isNovel = item.media_type === 'novel';
  const src = item.cover_url || COVER_FALLBACK;

  return (
    <motion.div className="card"
      onClick={onClick}
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
    >
      <div className="card-img-wrap">
        {onDelete && (
          <button className="card-del"
            onClick={e => { e.stopPropagation(); onDelete(item); }}
            aria-label="Remover"
          >✕</button>
        )}
        <img className="card-img" src={src} alt={item.title}
          onError={e => { e.currentTarget.src = COVER_FALLBACK; }} />
        <div className="card-shade" />
        <span className="card-tag">{isNovel ? 'NOVEL' : 'MANGA'}</span>
      </div>
      <div className="card-info">
        <div className="card-name">{item.title}</div>
        <div className="card-meta">{item.chapters?.length ?? 0} {isNovel ? 'partes' : 'caps'}</div>
      </div>
    </motion.div>
  );
}

export function CardSkeleton() {
  return (
    <div>
      <div className="skel card-skel-img" />
      <div className="skel card-skel-name" />
      <div className="skel card-skel-meta" />
    </div>
  );
}
