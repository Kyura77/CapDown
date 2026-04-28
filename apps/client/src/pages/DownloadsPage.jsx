import React from 'react';
import { Download, Loader2, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDownloads } from '../context/DownloadsContext';
import { api } from '../api/client';

function DownloadRow({ job, onCancel }) {
  const pct = Math.round((job.downloaded_chapters / (job.total_chapters || 1)) * 100);
  const isActive = job.status === 'downloading' || job.status === 'queued';
  const isFailed = job.status === 'failed';
  const isDone = job.status === 'completed';

  return (
    <motion.div
      className="flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-surface-border)]"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Status icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        isActive ? 'bg-brand-500/15' : isFailed ? 'bg-red-500/15' : 'bg-[var(--color-surface-elevated)]'
      }`}>
        {isActive
          ? <Loader2 size={16} className="animate-spin text-brand-400" />
          : isFailed
          ? <AlertTriangle size={16} className="text-red-400" />
          : <CheckCircle size={16} className="text-[var(--color-text-muted)]" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{job.manga_title ?? 'Preparando...'}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {isFailed ? '⚠ Falhou'
            : isDone ? 'Concluído'
            : `${job.downloaded_chapters ?? 0} / ${job.total_chapters ?? '?'} capítulos`
          }
        </p>

        {/* Animated progress bar */}
        {isActive && (
          <div className="mt-2 h-1 bg-[var(--color-surface-border)] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-500 rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            />
          </div>
        )}
      </div>

      {/* Cancel / Remove */}
      <motion.button
        className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-red-500/20 transition-colors shrink-0"
        whileTap={{ scale: 0.9 }}
        onClick={() => onCancel(job.id)}
        aria-label="Cancelar"
      >
        <X size={15} />
      </motion.button>
    </motion.div>
  );
}

function GroupSection({ title, icon: Icon, list, onCancel, accentClass }) {
  if (list.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={13} className={accentClass} />
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{title}</span>
        <span className="ml-auto text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-0.5 rounded-full">{list.length}</span>
      </div>
      <AnimatePresence>
        <div className="space-y-2">
          {list.map(j => <DownloadRow key={j.id} job={j} onCancel={onCancel} />)}
        </div>
      </AnimatePresence>
    </div>
  );
}

export default function DownloadsPage() {
  const { downloads, loading, error, refreshDownloads } = useDownloads();

  const active    = downloads.filter(j => ['queued', 'downloading'].includes(j.status));
  const failed    = downloads.filter(j => j.status === 'failed');
  const completed = downloads.filter(j => j.status === 'completed');

  const cancel = async id => {
    try { await api.deleteDownload(id); refreshDownloads(); } catch { /* ignore */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-4 py-5 pb-24"
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white">Downloads</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{downloads.length} total na fila</p>
      </div>

      {!loading && !error && downloads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center">
            <Download size={28} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">Nenhum download na fila.</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-400">
          <span className="text-4xl">⚠️</span>
          <p className="text-sm text-center">Falha ao carregar downloads.</p>
        </div>
      )}

      <GroupSection title="Em Andamento" icon={Loader2} list={active} onCancel={cancel} accentClass="text-brand-400" />
      <GroupSection title="Com Falha" icon={AlertTriangle} list={failed} onCancel={cancel} accentClass="text-red-400" />
      <GroupSection title="Concluídos" icon={CheckCircle} list={completed} onCancel={cancel} accentClass="text-[var(--color-text-muted)]" />
    </motion.div>
  );
}
