import React, { useEffect, useMemo, useState } from 'react';
import { Cloud, Database, Info, KeyRound, RefreshCw, Save, Send, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import {
  clearApiUrlOverride,
  getApiSourceLabel,
  readApiUrlOverride,
  resolveApiBaseUrl,
  writeApiUrlOverride,
} from '../api/runtime';
import { useProviderCatalog } from '../hooks/useProviderCatalog';
import { useProviderSession } from '../hooks/useProviderSession';

/* ── helpers ── */
const ISSUE_LABELS = {
  pages_missing:    'Páginas ausentes no banco',
  telegram_missing: 'Páginas sem upload no Telegram',
};
const issueLabel    = issue => ISSUE_LABELS[issue] || issue || 'Problema desconhecido';
const summarize     = reports =>
  reports.reduce((acc, r) => { const k = issueLabel(r.issue); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
const apiErr        = (err, fb) => err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message ?? fb;

/* ── reusable sub-components ── */
function Card({ icon: Icon, title, children }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
        <Icon size={18} style={{ color: 'var(--green)' }} />
      </div>
      {children}
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>}
      <input
        {...props}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border2)',
          borderRadius: 'var(--r-md)',
          padding: '10px 14px',
          color: 'var(--txt)',
          fontSize: 14,
          fontFamily: 'var(--font)',
          outline: 'none',
          width: '100%',
          transition: 'border-color 0.15s',
          ...props.style,
        }}
        onFocus={e => e.target.style.borderColor = 'var(--green)'}
        onBlur={e => e.target.style.borderColor = 'var(--border2)'}
      />
    </div>
  );
}

function SelectField({ label, children, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>}
      <select
        {...props}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border2)',
          borderRadius: 'var(--r-md)',
          padding: '10px 14px',
          color: 'var(--txt)',
          fontSize: 14,
          fontFamily: 'var(--font)',
          outline: 'none',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        {children}
      </select>
    </div>
  );
}

function Row({ label, sub, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ── main component ── */
export default function SettingsPage() {
  const { providers: availableProviders, loading: providersLoading } = useProviderCatalog();
  const { connected: verdinhaConnected, checking: checkingVerdinha, refreshSession } = useProviderSession('verdinha');

  const [apiUrl, setApiUrl]         = useState(() => readApiUrlOverride());
  const [concurrency, setConcurrency] = useState(() => parseInt(localStorage.getItem('capdown:concurrency') || '8', 10));
  const [useAI, setUseAI]           = useState(() => localStorage.getItem('capdown:use_ai') !== 'false');

  const [tgToken, setTgToken]       = useState('');
  const [tgChatId, setTgChatId]     = useState('');
  const [tgConnected, setTgConnected] = useState(false);
  const [savingTg, setSavingTg]     = useState(false);

  const [enabledProviders, setEnabledProviders] = useState([]);
  const [savingProviders, setSavingProviders]   = useState(false);

  const [providerId, setProviderId] = useState('');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [savingAcc, setSavingAcc]   = useState(false);
  const [solvingVip, setSolvingVip] = useState(false);

  const [report, setReport]         = useState(null);
  const [checking, setChecking]     = useState(false);

  const apiConfig      = useMemo(() => resolveApiBaseUrl(), []);
  const apiSourceLabel = getApiSourceLabel(apiConfig.source);

  useEffect(() => {
    api.getSettings().then(r => {
      // API now returns has_telegram_token (boolean) instead of raw token
      setTgConnected(r.data.has_telegram_token ?? false);
      setTgChatId(r.data.telegram_chat_id || '');
      setEnabledProviders(r.data.enabled_providers || []);
    }).catch(console.error);
  }, []);

  const saveGeneral = async () => {
    const prev = readApiUrlOverride();
    const next = apiUrl.trim();
    writeApiUrlOverride(next);
    localStorage.setItem('capdown:concurrency', concurrency.toString());
    localStorage.setItem('capdown:use_ai', useAI.toString());
    
    // Save enabled providers to API
    setSavingProviders(true);
    try {
      await api.saveSettings({ enabled_providers: enabledProviders });
    } catch {
      alert('Falha ao salvar provedores ativos.');
    } finally {
      setSavingProviders(false);
    }

    if (prev !== next) { alert('Configurações salvas. Recarregando...'); window.location.reload(); return; }
    alert('Configurações salvas.');
  };

  const saveTelegram = async () => {
    setSavingTg(true);
    try {
      await api.saveSettings({ telegram_token: tgToken, telegram_chat_id: tgChatId });
      setTgConnected(true);
      setTgToken(''); // clear the field after saving — don't keep in memory
      alert('Telegram salvo.');
    }
    catch { alert('Falha ao salvar Telegram.'); }
    finally { setSavingTg(false); }
  };

  const saveAccount = async () => {
    if (!providerId || !username.trim() || !password.trim()) { alert('Preencha todos os campos.'); return; }
    setSavingAcc(true);
    try {
      await api.saveAccount({ provider_id: providerId, username: username.trim(), password: password.trim() });
      setUsername(''); setPassword('');
      alert('Credencial salva no cofre.');
    } catch (err) { alert(`Falha: ${apiErr(err, 'erro desconhecido')}`); }
    finally { setSavingAcc(false); }
  };

  const solveVip = async () => {
    setSolvingVip(true);
    try {
      await api.solveAuth({ provider_id: 'verdinha', url: 'https://verdinha.wtf/', wait_seconds: 120 });
      await refreshSession();
      alert('Sessão VIP capturada!');
    } catch { alert('Falha ao capturar sessão VIP.'); }
    finally { setSolvingVip(false); }
  };

  const runIntegrity = async () => {
    setChecking(true);
    try { const r = await api.verifyLibrary(); setReport(r.data.reports); }
    catch { alert('Falha na verificação.'); }
    finally { setChecking(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="hero">
        <div className="hero-eyebrow">Control Room</div>
        <h1 className="hero-title" style={{ fontSize: 36 }}>Ajustes do cofre.</h1>
        <p className="hero-sub" style={{ marginBottom: 0 }}>Credenciais, Telegram e integridade em um só lugar.</p>
      </div>

      {/* Grid of cards */}
      <div className="section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>

        {/* Telegram */}
        <Card icon={Send} title="Integração Telegram">
          <Row
            label="Status do Telegram"
            sub={tgConnected ? 'Bot token configurado e salvo.' : 'Sem token configurado.'}
            right={
              <span style={{ fontSize: 12, fontWeight: 700, color: tgConnected ? '#4ade80' : 'var(--txt3)' }}>
                {tgConnected ? '● Ativo' : '○ Inativo'}
              </span>
            }
          />
          <p style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.5 }}>
            Informe o token para configurar ou atualizar. Ele <strong style={{ color: 'var(--txt2)' }}>não</strong> é exibido após salvo.
          </p>
          <Field label="Novo Bot Token" type="password" value={tgToken} onChange={e => setTgToken(e.target.value)} placeholder="1234567890:ABC..." />
          <Field label="Chat ou Channel ID" value={tgChatId} onChange={e => setTgChatId(e.target.value)} placeholder="-100..." />
          <button className="btn btn-primary" onClick={saveTelegram} disabled={savingTg}>
            {savingTg ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
            Salvar Telegram
          </button>
        </Card>

        {/* Conexão */}
        <Card icon={Cloud} title="Conexão e App">
          <Field
            label="Override da API"
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
            placeholder="http://127.0.0.1:4540"
          />
          <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
            API ativa: <strong style={{ color: 'var(--txt2)' }}>{apiConfig.baseUrl}</strong> ({apiSourceLabel})
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--txt2)', fontWeight: 600 }}>Concorrência</span>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>{concurrency}</span>
            </div>
            <input type="range" min="1" max="16" value={concurrency}
              onChange={e => setConcurrency(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--green)', cursor: 'pointer' }}
            />
          </div>

          <Row
            label="Busca com IA"
            sub="Expande termos quando o serviço local estiver disponível."
            right={
              <div
                onClick={() => setUseAI(v => !v)}
                style={{
                  width: 44, height: 24, borderRadius: 99,
                  background: useAI ? 'var(--green)' : 'var(--border2)',
                  cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: useAI ? 22 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: useAI ? '#000' : 'var(--txt3)',
                  transition: 'left 0.2s',
                }} />
              </div>
            }
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={saveGeneral}>Salvar Preferências</button>
            <button className="btn" onClick={() => { clearApiUrlOverride(); setApiUrl(''); window.location.reload(); }}
              disabled={!apiConfig.overrideUrl}>
              Restaurar padrão
            </button>
          </div>
        </Card>

        {/* Credenciais */}
        <Card icon={Shield} title="Credenciais">
          <Row
            label="Verdinha VIP"
            sub={`Status: ${checkingVerdinha ? 'verificando...' : verdinhaConnected ? 'conectado ✓' : 'desconectado'}`}
            right={
              <button className="btn" onClick={solveVip} disabled={solvingVip}>
                {solvingVip ? <RefreshCw size={13} className="spin" /> : <KeyRound size={13} />}
                {solvingVip ? 'Aguardando' : 'Conectar VIP'}
              </button>
            }
          />

          <div style={{ height: 1, background: 'var(--border)' }} />

          <SelectField label="Provedor" value={providerId} onChange={e => setProviderId(e.target.value)} disabled={providersLoading || !availableProviders.length}>
            <option value="">Selecione um provedor</option>
            {availableProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
          <Field label="Usuário" value={username} onChange={e => setUsername(e.target.value)} placeholder="usuário" />
          <Field label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" />
          <button className="btn" onClick={saveAccount} disabled={savingAcc || !providerId}>
            {savingAcc ? <RefreshCw size={13} className="spin" /> : null}
            Adicionar ao cofre
          </button>
        </Card>

        {/* Provedores Ativos */}
        <Card icon={Sparkles} title="Provedores Ativos">
          <p style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.5 }}>
            Selecione quais fontes aparecerão na busca.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {availableProviders.filter(p => p.status === 'enabled').map(p => (
              <Row
                key={p.id}
                label={p.name}
                sub={p.domains?.[0]}
                right={
                  <div
                    onClick={() => setEnabledProviders(prev => 
                      prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                    )}
                    style={{
                      width: 44, height: 24, borderRadius: 99,
                      background: enabledProviders.includes(p.id) ? 'var(--green)' : 'var(--border2)',
                      cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, left: enabledProviders.includes(p.id) ? 22 : 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: enabledProviders.includes(p.id) ? '#000' : 'var(--txt3)',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                }
              />
            ))}
          </div>
          <button className="btn btn-primary" onClick={saveGeneral} disabled={savingProviders}>
            {savingProviders ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
            Salvar Provedores
          </button>
        </Card>

        {/* Sistema */}
        <Card icon={Info} title="Sistema">
          <Row label="Armazenamento" right={<span style={{ fontSize: 13, color: 'var(--txt2)', fontWeight: 600 }}>Nuvem (Telegram)</span>} />
          <Row label="Banco legado" right={<span style={{ fontSize: 13, color: 'var(--txt2)', fontWeight: 600 }}>Transitório</span>} />
          <p style={{ fontSize: 12, color: 'var(--txt3)', lineHeight: 1.5 }}>
            A integridade valida IDs virtuais e a persistência dos arquivos no Telegram.
          </p>
          <button className="btn" onClick={runIntegrity} disabled={checking}>
            {checking ? <RefreshCw size={13} className="spin" /> : <Database size={13} />}
            Verificar integridade
          </button>

          {report && (
            <div style={{
              padding: '14px 16px',
              background: report.length === 0 ? 'rgba(74,222,128,0.08)' : 'var(--red-dim)',
              border: `1px solid ${report.length === 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
              borderRadius: 'var(--r-md)',
              fontSize: 13,
            }}>
              <strong style={{ color: report.length === 0 ? '#4ade80' : 'var(--red)' }}>
                {report.length === 0 ? '✓ Nenhum problema encontrado.' : `⚠ ${report.length} problema(s) encontrado(s).`}
              </strong>
              {report.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(summarize(report)).map(([label, count]) => (
                    <div key={label} style={{ color: 'var(--txt2)' }}>{count}× {label}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

      </div>
    </motion.div>
  );
}
