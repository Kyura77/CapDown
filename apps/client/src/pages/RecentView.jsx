import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLibrary } from '../context/LibraryContext';
import { MediaCard } from '../components/MediaCard';
import { useNavigate } from 'react-router-dom';

export default function RecentView() {
  const { library } = useLibrary();
  const navigate = useNavigate();

  const recentList = useMemo(() => {
    const manga = library?.manga || [];
    return [...manga].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 24);
  }, [library]);

  return (
    <main className="page">
      <section className="hero-panel" style={{ minHeight: 200, padding: '40px 56px' }}>
        <div>
          <span className="eyebrow">Recent Activity</span>
          <h1 className="page-title" style={{ fontSize: '3rem' }}>Últimas Atualizações.</h1>
          <p className="page-subtitle">Obras que foram atualizadas ou lidas recentemente.</p>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <div className="section-head">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={20} /> Recentes
          </h2>
        </div>

        {recentList.length === 0 ? (
          <div className="empty-state">Nenhuma atividade recente.</div>
        ) : (
          <div className="grid-results">
            {recentList.map((manga, index) => (
              <motion.div
                key={manga.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <MediaCard 
                  item={manga} 
                  onClick={() => navigate(`/manga/${manga.id}`)} 
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
