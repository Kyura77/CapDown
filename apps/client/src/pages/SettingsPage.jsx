import React, { useEffect, useMemo, useState } from 'react';
import { Cloud, Database, Info, KeyRound, RefreshCw, Save, Send, Shield } from 'lucide-react';
import { api } from '../api/client';
import { clearApiUrlOverride, getApiSourceLabel, readApiUrlOverride, resolveApiBaseUrl, writeApiUrlOverride } from '../api/runtime';
import { useProviderCatalog } from '../hooks/useProviderCatalog';
import { useProviderSession } from '../hooks/useProviderSession';

const ISSUE_LABELS = {
  pages_missing: 'Páginas ausentes no banco',
  telegram_missing: 'Páginas sem upload no Telegram',
};

function issueLabel(issue) {
  return ISSUE_LABELS[issue] || issue || 'Problema desconhecido';
}

function summarizeIssues(reports) {
  return reports.reduce((acc, report) => {
    const key = issueLabel(report.issue);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function extractApiError(error, fallback) {
  const raw = error?.response?.data;
  if (typeof raw === 'string' && raw.trim()) {
    return raw;
  }
  if (typeof raw?.error === 'string' && raw.error.trim()) {
    return raw.error;
  }
  if (typeof raw?.message === 'string' && raw.message.trim()) {
    return raw.message;
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function SettingsPage() {
  const { providers: availableProviders, loading: providersLoading } = useProviderCatalog();
  const { connected: verdinhaConnected, checking: checkingVerdinha, refreshSession: refreshVerdinhaSession } = useProviderSession('verdinha');

  const [apiUrl, setApiUrl] = useState(() => readApiUrlOverride());
  const [concurrency, setConcurrency] = useState(() => parseInt(localStorage.getItem('capdown:concurrency') || '8', 10));
  const [useAI, setUseAI] = useState(() => localStorage.getItem('capdown:use_ai') !== 'false');
  const [integrityReport, setIntegrityReport] = useState(null);
  const [loadingIntegrity, setLoadingIntegrity] = useState(false);

  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [savingTg, setSavingTg] = useState(false);

  const [providerId, setProviderId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [solvingVerdinha, setSolvingVerdinha] = useState(false);

  const apiConfig = useMemo(() => resolveApiBaseUrl(), []);

  useEffect(() => {
    api.getSettings()
      .then((res) => {
        setTgToken(res.data.telegram_token || '');
        setTgChatId(res.data.telegram_chat_id || '');
      })
      .catch(console.error);
  }, []);

  const handleSaveGeneral = async () => {
    const previousApiUrl = readApiUrlOverride();
    const nextApiUrl = apiUrl.trim();

    writeApiUrlOverride(nextApiUrl);
    localStorage.setItem('capdown:concurrency', concurrency.toString());
    localStorage.setItem('capdown:use_ai', useAI.toString());

    if (previousApiUrl !== nextApiUrl) {
      alert('Configurações salvas. A API foi alterada, a interface será recarregada.');
      window.location.reload();
      return;
    }

    alert('Configurações locais salvas.');
  };

  const handleResetApiUrl = () => {
    clearApiUrlOverride();
    setApiUrl('');
    window.location.reload();
  };

  const handleSaveTelegram = async () => {
    setSavingTg(true);
    try {
      await api.saveSettings({
        telegram_token: tgToken,
        telegram_chat_id: tgChatId,
      });
      alert('Configurações do Telegram salvas.');
    } catch {
      alert('Falha ao salvar configurações do Telegram.');
    } finally {
      setSavingTg(false);
    }
  };

  const handleSaveAccount = async () => {
    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (!providerId) {
      alert('Selecione um provedor antes de salvar a credencial.');
      return;
    }

    if (!normalizedUsername || !normalizedPassword) {
      return;
    }

    setSavingAccount(true);
    try {
      await api.saveAccount({
        provider_id: providerId,
        username: normalizedUsername,
        password: normalizedPassword,
      });
      setUsername('');
      setPassword('');
      alert('Credencial salva no Windows Keyring.');
    } catch (error) {
      alert(`Falha ao salvar credencial: ${extractApiError(error, 'erro desconhecido')}`);
    } finally {
      setSavingAccount(false);
    }
  };

  const runIntegrityCheck = async () => {
    setLoadingIntegrity(true);
    try {
      const res = await api.verifyLibrary();
      setIntegrityReport(res.data.reports);
    } catch {
      alert('Falha na verificação de integridade.');
    } finally {
      setLoadingIntegrity(false);
    }
  };

  const handleSolveVerdinha = async () => {
    setSolvingVerdinha(true);
    try {
      await api.solveAuth({
        provider_id: 'verdinha',
        url: 'https://verdinha.wtf/',
        wait_seconds: 120,
      });
      await refreshVerdinhaSession();
      alert('Sessão VIP da Verdinha capturada.');
    } catch {
      alert('Falha ao capturar a sessão VIP da Verdinha.');
    } finally {
      setSolvingVerdinha(false);
    }
  };

  const apiSourceLabel = getApiSourceLabel(apiConfig.source);
  const providerSelectDisabled = providersLoading || availableProviders.length === 0;

  return (
    <main className="page">
      <section className="hero-panel" style={{ minHeight: 260 }}>
        <div>
          <span className="eyebrow">Control room</span>
          <h1 className="page-title">Ajustes do cofre.</h1>
          <p className="page-subtitle">Credenciais, armazenamento na nuvem, Telegram e integridade em um só lugar.</p>
        </div>
      </section>

      <section className="settings-grid" style={{ marginTop: 20 }}>
        <article className="settings-panel">
          <div className="panel-title">
            <span>Integração Telegram</span>
            <Send size={20} color="var(--acid)" />
          </div>
          <p className="small-text" style={{ marginBottom: 8 }}>
            O CapDown opera em modo <strong>Telegram-first</strong>. Todo o conteúdo é enviado diretamente para a nuvem.
          </p>
          <input className="field" type="password" value={tgToken} onChange={(event) => setTgToken(event.target.value)} placeholder="Bot token" />
          <input className="field" value={tgChatId} onChange={(event) => setTgChatId(event.target.value)} placeholder="Chat ou channel ID" />
          <button className="btn btn-primary" onClick={handleSaveTelegram} disabled={savingTg}>
            {savingTg ? <RefreshCw className="spin" size={18} /> : <Save size={18} />}
            Salvar Telegram
          </button>
        </article>

        <article className="settings-panel">
          <div className="panel-title">
            <span>Conexão e App</span>
            <Cloud size={20} color="var(--acid)" />
          </div>
          <input
            className="field"
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            placeholder="Override opcional da API, ex: http://127.0.0.1:4540"
          />
          <p className="small-text" style={{ marginTop: 8 }}>
            API ativa: <strong>{apiConfig.baseUrl}</strong> ({apiSourceLabel})
          </p>
          {apiConfig.overrideUrl && (
            <p className="small-text" style={{ marginTop: 4 }}>
              Override local em uso. Limpe para voltar ao padrão do ambiente.
            </p>
          )}
          <label>
            <span className="small-text">Concorrência de download: {concurrency}</span>
            <input
              type="range"
              min="1"
              max="16"
              value={concurrency}
              onChange={(event) => setConcurrency(parseInt(event.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--acid)' }}
            />
          </label>
          <label className="toggle-row">
            <span>
              <strong>Busca com IA</strong>
              <p className="small-text">Expande termos quando o serviço local estiver disponível.</p>
            </span>
            <input type="checkbox" checked={useAI} onChange={(event) => setUseAI(event.target.checked)} />
          </label>
          <div className="chip-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={handleSaveGeneral}>Salvar Preferências</button>
            <button className="btn" onClick={handleResetApiUrl} disabled={!apiConfig.overrideUrl}>Restaurar padrão</button>
          </div>
        </article>

        <article className="settings-panel">
          <div className="panel-title">
            <span>Credenciais</span>
            <Shield size={20} color="var(--ok)" />
          </div>
          <div className="toggle-row">
            <span>
              <strong>Verdinha VIP</strong>
              <p className="small-text">Status: {checkingVerdinha ? 'verificando' : verdinhaConnected ? 'conectado' : 'desconectado'}</p>
            </span>
            <KeyRound size={22} color={verdinhaConnected ? 'var(--ok)' : 'var(--faint)'} />
          </div>
          <button className="btn" onClick={handleSolveVerdinha} disabled={solvingVerdinha}>
            {solvingVerdinha ? <RefreshCw className="spin" size={18} /> : <KeyRound size={18} />}
            {solvingVerdinha ? 'Aguardando login' : 'Conectar Verdinha VIP'}
          </button>
          <select className="select-field" value={providerId} onChange={(event) => setProviderId(event.target.value)} disabled={providerSelectDisabled}>
            <option value="">Selecione um provedor</option>
            {availableProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <p className="small-text" style={{ marginTop: 6 }}>
            {providersLoading
              ? 'Carregando catálogo de provedores...'
              : availableProviders.length === 0
                ? 'Nenhum provedor retornado pela API.'
                : 'O catálogo vem da API e não é mais fixo no cliente.'}
          </p>
          <input className="field" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Usuário" />
          <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha" />
          <button className="btn" onClick={handleSaveAccount} disabled={savingAccount || providerSelectDisabled}>
            {savingAccount ? 'Salvando' : 'Adicionar ao cofre'}
          </button>
        </article>

        <article className="settings-panel">
          <div className="panel-title">
            <span>Sistema</span>
            <Info size={20} color="var(--acid)" />
          </div>
          <div className="toggle-row"><span>Armazenamento</span><strong>Nuvem (Telegram)</strong></div>
          <div className="toggle-row"><span>Banco legado</span><strong>Transitório</strong></div>
          <p className="small-text">
            A integridade valida os IDs virtuais e a persistência dos arquivos no Telegram.
          </p>
          <button className="btn" onClick={runIntegrityCheck} disabled={loadingIntegrity}>
            {loadingIntegrity ? <RefreshCw className="spin" size={18} /> : <Database size={18} />}
            Verificar integridade
          </button>
          {integrityReport && (
            <div className={`integrity-report ${integrityReport.length === 0 ? 'ok' : 'warn'}`}>
              <strong>
                {integrityReport.length === 0 ? 'Nenhum problema encontrado.' : `${integrityReport.length} problema(s) encontrados.`}
              </strong>
              {integrityReport.length > 0 && (
                <>
                  <div className="integrity-summary">
                    {Object.entries(summarizeIssues(integrityReport)).map(([label, count]) => (
                      <span key={label}>{count}x {label}</span>
                    ))}
                  </div>
                  <div className="integrity-list" aria-label="Problemas de integridade encontrados">
                    {integrityReport.map((item, index) => (
                      <article className="integrity-item" key={`${item.chapter_id || index}-${item.issue || 'issue'}`}>
                        <div>
                          <span className="integrity-issue">{issueLabel(item.issue)}</span>
                          <strong>{item.manga_title || 'Manga sem título'}</strong>
                          <p>{item.chapter_title || item.chapter_id || 'Capítulo sem identificação'}</p>
                        </div>
                        <dl>
                          {item.chapter_id && (
                            <>
                              <dt>ID</dt>
                              <dd>{item.chapter_id}</dd>
                            </>
                          )}
                          {item.expected_pages !== undefined && (
                            <>
                              <dt>Páginas esperadas</dt>
                              <dd>{item.expected_pages}</dd>
                            </>
                          )}
                          {item.telegram_pages !== undefined && (
                            <>
                              <dt>Telegram</dt>
                              <dd>{item.telegram_pages}</dd>
                            </>
                          )}
                        </dl>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
