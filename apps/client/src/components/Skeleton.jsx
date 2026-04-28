import React from 'react';
import { motion } from 'framer-motion';

export function Skeleton({ width, height, className = '', style = {}, rounded = 'var(--radius)' }) {
  return (
    <motion.div
      className={`skeleton-base ${className}`}
      style={{
        width: width || '100%',
        height: height || '100%',
        borderRadius: rounded,
        ...style
      }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
    />
  );
}

export function MediaCardSkeleton() {
  return (
    <div className="media-card-skeleton">
      <Skeleton height="auto" style={{ aspectRatio: '2/3' }} rounded="20px" />
      <div className="media-info-skeleton">
        <Skeleton height="18px" width="80%" style={{ marginTop: '16px', marginBottom: '8px' }} />
        <Skeleton height="14px" width="40%" />
      </div>
    </div>
  );
}
