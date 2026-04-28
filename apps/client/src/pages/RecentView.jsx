import React from 'react';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../context/LibraryContext';
import { MediaCard } from '../components/MediaCard';

export default function RecentView() {
  const navigate = useNavigate();
  const { library } = useLibrary();

  const recents = [...(library?.manga ?? [])]
    .filter(m => m.last_read_at)
    .sort((a, b) => new Date(b.last_read_at) - new Date(a.last_read_at))
    .slice(0, 24);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="section">
        <h1 className="page-title">Recentes</h1>
        <div className="muted">{recents.length} obras lidas recentemente</div>
      </div>

      {recents.length === 0 ? (
        <div className="empty">
          <Clock size={44} className="empty-icon" />
          <p>Nenhuma leitura recente ainda.</p>
        </div>
      ) : (
        <div className="section" style={{ paddingTop: 0 }}>
          <div className="grid">
            {recents.map(m => (
              <MediaCard key={m.id} item={m} onClick={() => navigate(`/manga/${m.id}`)} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
