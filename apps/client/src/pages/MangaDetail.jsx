import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Play, RefreshCw, ShieldAlert, Trash2, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client';
import { useLibrary } from '../context/LibraryContext';

const PLACEHOLDER = 'https://placehold.co/500x750/10120f/bcff4d?text=CapDown';

const fmtProvider = (id) => (id || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export default function MangaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { library, refreshLibrary } = useLibrary();

  const [auditing, setAuditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preparingTelegram, setPreparingTelegram] = useState(false);
  const [issues, setIssues] = useState([]);
  const [coverError, setCoverError] = useState(false);
  const [mangaDetail, setMangaDetail] = useState(null);
  const [chapterPage, setChapterPage] = useState(1);

  const manga = mangaDetail || library?.manga?.find((item) => item.id === id);
  const chapters = useMemo(() => {
    if (!manga) return [];
    return [...manga.chapters].sort((a, b) => parseFloat(b.number || 0) - parseFloat(a.number || 0));
  }, [manga]);
  const CHAPTERS_PER_PAGE = 40;
  const pageCount = Math.max(1, Math.ceil(chapters.length / CHAPTERS_PER_PAGE));
  const safeChapterPage = Math.min(chapterPage, pageCount);
  const visibleChapters = useMemo(
    () => chapters.slice((safeChapterPage - 1) * CHAPTERS_PER_PAGE, safeChapterPage * CHAPTERS_PER_PAGE),
    [safeChapterPage, chapters],
  );

  useEffect(() => {
    let cancelled = false;
    api.getManga(id).then((res) => {
      if (!cancelled) setMangaDetail(res.data);
    }).catch(() => {
      if (!cancelled) setMangaDetail(null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!manga) {
    return (
      <div className="page">
        <div className="empty-state">Manga nao encontrado.</div>
      </div>
    );
  }

  const cover = coverError ? PLACEHOLDER : (manga.cover_url || PLACEHOLDER);

  const handleAudit = async () => {
    setAuditing(true);
    try {
      const res = await api.auditManga(id);
      setIssues(res.data.discrepancies || []);
    } catch {
      setIssues([]);
    } finally {
      setAuditing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Excluir "${manga.title}" e todos os arquivos?`)) return;
    setDeleting(true);
    try {
      await api.deleteManga(id);
      await refreshLibrary?.();
      navigate('/');
    } catch {
      alert('Erro ao excluir obra.');
      setDeleting(false);
    }
  };

  const handlePrepareTelegram = async () => {
    setPreparingTelegram(true);
    try {
      const res = await api.prepareMangaTelegram(id);
      await refreshLibrary?.();
      const detail = await api.getManga(id);
      setMangaDetail(detail.data);
      const failures = res.data.failed_pages?.length || 0;
      alert(failures ? `Telegram preparado com ${failures} falha(s).` : 'Telegram preparado com sucesso.');
    } catch {
      alert('Falha ao preparar a obra para o Telegram.');
    } finally {
      setPreparingTelegram(false);
    }
  };

  return (
    <div className="ambient-page">
      <div className="ambient-bg" style={{ backgroundImage: `url(${cover})` }} />
      <main className="page">
        <div className="section-head" style={{ marginTop: 0 }}>
          <button className="btn" onClick={() => navigate(-1)}>
            <ChevronLeft size={18} />
            Voltar
          </button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? <RefreshCw size={18} className="spin" /> : <Trash2 size={18} />}
            Excluir
          </button>
        </div>

        <section className="detail-hero">
          <motion.img
            className="detail-cover"
            src={cover}
            alt={manga.title}
            onError={() => setCoverError(true)}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          />
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <span className="chip">{fmtProvider(manga.provider_id)}</span>
            <h1 className="page-title" style={{ marginTop: 18 }}>{manga.title}</h1>
            <p className="page-subtitle">{chapters.length} capitulos salvos na biblioteca.</p>
            <div className="stat-strip">
              <button className="btn btn-primary" disabled={!chapters.length} onClick={() => chapters.length && navigate(`/reader/${manga.id}/${chapters[chapters.length - 1].id}`)}>
                <Play size={18} />
                Ler do inicio
              </button>
              <button className="btn" onClick={handlePrepareTelegram} disabled={preparingTelegram || !chapters.length}>
                {preparingTelegram ? <RefreshCw size={18} className="spin" /> : <Send size={18} />}
                Preparar pro Telegram
              </button>
              <button className="btn" onClick={handleAudit} disabled={auditing}>
                {auditing ? <RefreshCw size={18} className="spin" /> : <ShieldAlert size={18} />}
                Auditar
              </button>
            </div>
            {issues.length > 0 && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{issues.length} capitulo(s) com divergencias.</span>
              </div>
            )}
          </motion.div>
        </section>

        <section>
          <div className="section-head">
            <h2>Capitulos</h2>
            <span className="faint">{chapters.length} itens</span>
          </div>
          <div className="chapter-list">
            <AnimatePresence initial={false}>
              {visibleChapters.map((chapter) => {
                const hasIssue = issues.some((issue) => issue.chapter_id === chapter.id);
                return (
                  <button
                    key={chapter.id}
                    className="chapter-row"
                    onClick={() => navigate(`/reader/${manga.id}/${chapter.id}`)}
                  >
                    <span className="chapter-number">{chapter.number || '?'}</span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chapter.title}
                      </strong>
                      <span className="small-text">{chapter.page_count ?? chapter.pages.length} paginas</span>
                    </span>
                    {hasIssue ? <AlertCircle size={18} color="var(--danger)" /> : <Play size={18} color="var(--faint)" />}
                  </button>
                );
              })}
            </AnimatePresence>
          </div>
          {pageCount > 1 && (
            <div className="stat-strip" style={{ marginTop: 16 }}>
              <button className="btn" disabled={chapterPage <= 1} onClick={() => setChapterPage((value) => Math.max(1, value - 1))}>
                Pagina anterior
              </button>
              <span className="faint">Pagina {safeChapterPage} de {pageCount}</span>
              <button className="btn" disabled={safeChapterPage >= pageCount} onClick={() => setChapterPage((value) => Math.min(pageCount, value + 1))}>
                Proxima pagina
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
