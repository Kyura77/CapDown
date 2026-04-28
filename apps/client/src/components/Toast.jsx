import React, { createContext, useCallback, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

// Context exported separately to satisfy react-refresh (no mixed component+context export)
const ToastCtx = createContext({ toast: () => {} });

/* eslint-disable react-refresh/only-export-components */
export const useToast = () => useContext(ToastCtx);
/* eslint-enable react-refresh/only-export-components */

function ToastIcon({ type }) {
  if (type === 'success') return <CheckCircle2 size={18} className="toast-ico-success" />;
  if (type === 'error')   return <AlertCircle  size={18} className="toast-ico-error" />;
  return <Info size={18} className="toast-ico-info" />;
}

function ToastItem({ t, onRemove }) {
  return (
    <motion.div className="toast"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
    >
      <ToastIcon type={t.type} />
      <div className="toast-body">
        {t.title && <div className="toast-title">{t.title}</div>}
        {t.desc  && <div className="toast-desc">{t.desc}</div>}
      </div>
      <button className="toast-close btn-ghost btn-icon" onClick={() => onRemove(t.id)}>
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [list, setList] = useState([]);

  const toast = useCallback(({ title, desc, type = 'info', ms = 4000 }) => {
    const id = crypto.randomUUID();
    setList(p => [...p, { id, title, desc, type }]);
    if (ms > 0) setTimeout(() => setList(p => p.filter(t => t.id !== id)), ms);
  }, []);

  const remove = useCallback(id => setList(p => p.filter(t => t.id !== id)), []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="toast-stack">
        <AnimatePresence>
          {list.map(t => <ToastItem key={t.id} t={t} onRemove={remove} />)}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
