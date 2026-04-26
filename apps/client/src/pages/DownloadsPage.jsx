import React, { useMemo } from 'react';
import { CheckCircle2, Clock, Download, Loader2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDownloads } from '../context/DownloadsContext';

function statusTone(status) {
  if (status === 'completed') return { icon: CheckCircle2, color: 'var(--ok)', label: 'Concluido' };
  if (status === 'failed') return { icon: XCircle, color: 'var(--danger)', label: 'Falhou' };
  if (status === 'downloading') return { icon: Loader2, color: 'var(--acid)', label: 'Baixando' };
  return { icon: Clock, color: 'var(--faint)', label: status };
}

export default function DownloadsPage() {
  const { downloads } = useDownloads();
  const sortedDownloads = useMemo(
    () => [...downloads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [downloads]
  );

  return (
    <main className="page">
      <section className="hero-panel" style={{ minHeight: 260 }}>
        <div>
          <span className="eyebrow">Download engine</span>
          <h1 className="page-title">Fila de captura.</h1>
          <p className="page-subtitle">Acompanhe progresso, erros e historico sem abrir o terminal.</p>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Jobs</h2>
          <span className="faint">{sortedDownloads.length} registros</span>
        </div>

        <div className="download-list">
          {sortedDownloads.map((job, index) => {
            const tone = statusTone(job.status);
            const Icon = tone.icon;
            const pct = Math.round((job.downloaded_chapters / (job.total_chapters || 1)) * 100);

            return (
              <motion.article
                key={job.id}
                className="download-row"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.3) }}
              >
                <div className="chapter-number" style={{ color: tone.color }}>
                  {job.status === 'downloading' ? <Icon size={18} className="spin" /> : <Download size={18} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.manga_title || job.url}
                  </strong>
                  <p className="small-text">
                    {new Date(job.created_at).toLocaleString()}
                    {job.current_chapter ? ` · ${job.current_chapter}` : ''}
                    {job.total_pages > 0 ? ` · ${job.downloaded_pages}/${job.total_pages} paginas` : ''}
                  </p>
                  {job.status === 'downloading' && (
                    <div className="progress-track" style={{ marginTop: 8 }}>
                      <motion.div className="progress-fill" animate={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {job.error && <p className="small-text" style={{ color: 'var(--danger)' }}>{job.error}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: tone.color }}>
                  <span className="chip">{tone.label}</span>
                  <Icon size={18} className={job.status === 'downloading' ? 'spin' : ''} />
                </div>
              </motion.article>
            );
          })}
          {sortedDownloads.length === 0 && <div className="empty-state">Nenhum download ainda.</div>}
        </div>
      </section>
    </main>
  );
}
