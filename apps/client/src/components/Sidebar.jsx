import React from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Clock, Download, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const NAV = [
  { to: '/',          icon: BookOpen,  label: 'Biblioteca' },
  { to: '/downloads', icon: Download,  label: 'Downloads'  },
  { to: '/recent',    icon: Clock,     label: 'Recentes'   },
  { to: '/settings',  icon: Settings,  label: 'Ajustes'    },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark" />
        CAPDOWN
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="storage-label">Armazenamento</div>
        <div className="storage-bar">
          <motion.div className="storage-fill"
            initial={{ width: 0 }} animate={{ width: '62%' }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
        <div className="storage-text">12.4 GB / 20 GB</div>
      </div>
    </aside>
  );
}
