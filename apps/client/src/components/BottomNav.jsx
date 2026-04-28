import React from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Clock, Download, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { to: '/',          icon: BookOpen,  label: 'Biblioteca' },
  { to: '/recent',    icon: Clock,     label: 'Recentes'   },
  { to: '/downloads', icon: Download,  label: 'Downloads'  },
  { to: '/settings',  icon: Settings,  label: 'Config'     },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-pb">
      <div className="glass-elevated mx-3 mb-3 rounded-2xl px-2 py-2">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors ${
                  isActive
                    ? 'text-brand-400'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <motion.div
                    animate={isActive ? { scale: 1.15, y: -1 } : { scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  </motion.div>
                  <span className={`text-[9px] font-semibold tracking-wide uppercase ${isActive ? 'text-brand-400' : ''}`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
