import React from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Download, Clock, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

export function BottomNav() {
  return (
    <nav className="bottom-nav-glass">
      <ul className="bottom-nav-list">
        <li>
          <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} end>
            <BookOpen size={22} />
            <span>Início</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/recent" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <Clock size={22} />
            <span>Recentes</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/downloads" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <Download size={22} />
            <span>Fila</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/settings" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={22} />
            <span>Ajustes</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
