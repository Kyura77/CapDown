import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Library, Download, Clock, Bookmark, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const NAV = [
  { to: '/', icon: <Library size={18} />, label: 'Library' },
  { to: '/downloads', icon: <Download size={18} />, label: 'Queue' },
  { to: '/recent', icon: <Clock size={18} />, label: 'Recent' },
  { to: '/bookmarks', icon: <Bookmark size={18} />, label: 'Bookmarks' },
  { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
];

const NavItem = ({ to, icon, label }) => {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
};

export function Sidebar() {
  return (
    <aside className="sidebar-glass">
      <div className="sidebar-brand">
        <div className="brand-logo"></div>
        CAPDOWN
      </div>
      
      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="sidebar-storage">
        <div className="storage-label">Storage</div>
        <div className="storage-bar">
          <motion.div 
            className="storage-fill" 
            initial={{ width: 0 }} 
            animate={{ width: '65%' }} 
            transition={{ duration: 1, delay: 0.2 }}
          />
        </div>
        <div className="storage-details">12.4 GB / 20 GB</div>
      </div>
    </aside>
  );
}
