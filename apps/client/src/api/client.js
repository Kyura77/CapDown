import axios from 'axios';
import { resolveApiBaseUrl } from './runtime';

export const API_BASE_URL = resolveApiBaseUrl().baseUrl;

// FIX BUG-06: Content-Type removido do default global.
// Requests GET não devem carregar esse header — evita CORS preflight desnecessário
// e comportamento incorreto em alguns proxies. O axios já define Content-Type correto
// automaticamente para POST/PUT com body JSON.
const client = axios.create({
  baseURL: API_BASE_URL,
});

export const api = {
  getHealth: () => client.get('/api/health'),
  getProviders: () => client.get('/api/providers'),
  search: (query, { limit = 20, page = 1, providers, deep = false } = {}) =>
    client.get('/api/search', { params: { q: query, limit, page, deep, ...(providers ? { providers } : {}) } }),
  searchAi: (query, { limit = 20, page = 1, providers, deep = false } = {}) =>
    client.get('/api/search/ai', { params: { q: query, limit, page, deep, ...(providers ? { providers } : {}) } }),
  preview: (url) => client.post('/api/preview', { url }),
  createDownload: (data) => client.post('/api/downloads', data),
  getDownloads: () => client.get('/api/downloads'),
  getDownload: (id) => client.get(`/api/downloads/${id}`),
  deleteDownload: (id) => client.delete(`/api/downloads/${id}`),
  getLibrary: () => client.get('/api/library'),
  getManga: (id) => client.get(`/api/library/${id}`),
  getReaderChapter: (mangaId, chapterId) => client.get(`/api/library/${mangaId}/chapters/${chapterId}`),
  deleteManga: (id) => client.delete(`/api/library/${id}`),
  prepareMangaTelegram: (id) => client.post(`/api/library/${id}/prepare-telegram`),
  auditManga: (id) => client.get(`/api/library/${id}/audit`),
  verifyLibrary: () => client.post('/api/library/verify'),
  getSettings: () => client.get('/api/settings'),
  saveSettings: (data) => client.post('/api/settings', data),
  saveAccount: (data) => client.post('/api/auth/accounts', data),
  getAuthSession: (providerId) => client.get(`/api/auth/session/${providerId}`),
  solveAuth: (data) => client.post('/api/auth/solve', data),
  getTelegramPageUrl: (chapterId, index) => `${API_BASE_URL}/api/library/pages/TELEGRAM/${chapterId}/${index}`,
};

export default client;
