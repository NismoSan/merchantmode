import { useState, useEffect } from 'react';
import { Save, Check, Copy, Settings as SettingsIcon, Server, Bot, MessageSquare, Timer, Globe, LogOut, ShieldCheck, AlertCircle } from 'lucide-react';

export default function Settings() {
  const [clientPath, setClientPath] = useState('');
  const [replyAvailable, setReplyAvailable] = useState('');
  const [replyNotFound, setReplyNotFound] = useState('');
  const [replyBuying, setReplyBuying] = useState('');
  const [replyTrade, setReplyTrade] = useState('');
  const [exchangeTimeout, setExchangeTimeout] = useState('60');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // AE Auth state
  const [aeLoggedIn, setAeLoggedIn] = useState(false);
  const [aeUsername, setAeUsername] = useState('');
  const [aeVerified, setAeVerified] = useState(false);
  const [aeLoginUser, setAeLoginUser] = useState('');
  const [aeLoginPass, setAeLoginPass] = useState('');
  const [aeLoginError, setAeLoginError] = useState('');
  const [aeLoggingIn, setAeLoggingIn] = useState(false);

  useEffect(() => {
    const api = window.merchantMode;
    if (!api) return;

    api.launcher.getPath().then(setClientPath);
    api.settings.get('reply_available', 'I have {item} for {price}. Open exchange with me to buy.').then(setReplyAvailable);
    api.settings.get('reply_not_found', "Sorry, I don't have that item for sale.").then(setReplyNotFound);
    api.settings.get('reply_buying', 'I am buying {item} for {price}. Open exchange with me to sell.').then(setReplyBuying);
    api.settings.get('reply_trade', 'I will trade {item} for {wanted}. Open exchange with me.').then(setReplyTrade);
    api.settings.get('exchange_timeout', '60').then(setExchangeTimeout);
    api.settings.get('auto_reply_enabled', 'true').then((v) => setAutoReplyEnabled(v === 'true'));

    // Load AE auth status
    api.ae.getAuthStatus().then((status) => {
      setAeLoggedIn(status.loggedIn);
      setAeUsername(status.username || '');
      setAeVerified(status.verified || false);
    });

    api.ae.onAuthChanged((status) => {
      setAeLoggedIn(status.loggedIn);
      setAeUsername(status.username || '');
      setAeVerified(status.verified || false);
    });
  }, []);

  async function handleSave() {
    const api = window.merchantMode?.settings;
    if (!api) return;

    await api.set('auto_reply_enabled', autoReplyEnabled.toString());
    await api.set('reply_available', replyAvailable);
    await api.set('reply_not_found', replyNotFound);
    await api.set('reply_buying', replyBuying);
    await api.set('reply_trade', replyTrade);
    await api.set('exchange_timeout', exchangeTimeout);
    if (clientPath) {
      const launcher = window.merchantMode?.settings;
      if (launcher) await launcher.set('client_path', clientPath);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="page-hero animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="page-hero-icon">
            <SettingsIcon size={22} style={{ color: 'var(--color-gold-400)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="page-hero-title">Settings</h1>
            <p className="page-hero-subtitle">Configure your merchant automation preferences</p>
          </div>
          <button
            onClick={handleSave}
            className="btn-primary px-5 py-2.5 rounded-lg text-sm"
            style={{
              background: saved
                ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                : undefined,
            }}
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* AislingExchange Account */}
      <div className="section-card animate-slide-up" style={{ animationDelay: '80ms' }}>
        <div className="section-header">
          <Globe size={16} className="section-icon" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }} className="gold-text">AislingExchange Account</h3>
        </div>
        {aeLoggedIn ? (
          <div className="space-y-3">
            <div
              className="flex items-center justify-between"
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: 'var(--color-surface-200)',
                border: '1px solid rgba(74,222,128,0.2)',
              }}
            >
              <div className="flex items-center gap-3">
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #dbb85e, #b8973e)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700, color: 'var(--color-surface-50)',
                }}>
                  {aeUsername.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{aeUsername}</span>
                    {aeVerified && (
                      <span className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--color-success)', fontWeight: 600 }}>
                        <ShieldCheck size={12} /> Verified
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    Listings auto-sync to aislingexchange.com
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  await window.merchantMode?.ae.logout();
                }}
                className="btn-secondary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
              >
                <LogOut size={12} /> Log Out
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Log in to sync your listings to the AislingExchange marketplace and access item data.
            </p>
            {aeLoginError && (
              <div className="flex items-center gap-2" style={{
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: 12, color: '#ef4444',
              }}>
                <AlertCircle size={14} /> {aeLoginError}
              </div>
            )}
            <input
              type="text"
              placeholder="Username"
              value={aeLoginUser}
              onChange={(e) => setAeLoginUser(e.target.value)}
              className="input-field block w-full"
              onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('ae-pass')?.focus(); }}
            />
            <input
              id="ae-pass"
              type="password"
              placeholder="Password"
              value={aeLoginPass}
              onChange={(e) => setAeLoginPass(e.target.value)}
              className="input-field block w-full"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && aeLoginUser && aeLoginPass && !aeLoggingIn) {
                  setAeLoggingIn(true);
                  setAeLoginError('');
                  const result = await window.merchantMode?.ae.login(aeLoginUser, aeLoginPass);
                  if (result?.success) {
                    setAeLoginUser('');
                    setAeLoginPass('');
                  } else {
                    setAeLoginError(result?.error || 'Login failed');
                  }
                  setAeLoggingIn(false);
                }
              }}
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => window.merchantMode?.shell.openExternal('https://aislingexchange.com')}
                className="text-xs"
                style={{ color: 'var(--color-gold-400)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Don't have an account? Register on AE
              </button>
              <button
                onClick={async () => {
                  if (!aeLoginUser || !aeLoginPass || aeLoggingIn) return;
                  setAeLoggingIn(true);
                  setAeLoginError('');
                  const result = await window.merchantMode?.ae.login(aeLoginUser, aeLoginPass);
                  if (result?.success) {
                    setAeLoginUser('');
                    setAeLoginPass('');
                  } else {
                    setAeLoginError(result?.error || 'Login failed');
                  }
                  setAeLoggingIn(false);
                }}
                disabled={!aeLoginUser || !aeLoginPass || aeLoggingIn}
                className="btn-primary px-5 py-2 rounded-lg text-xs"
                style={{ opacity: (!aeLoginUser || !aeLoginPass || aeLoggingIn) ? 0.5 : 1 }}
              >
                {aeLoggingIn ? 'Logging in...' : 'Log In'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Client & Proxy */}
      <div className="section-card animate-slide-up" style={{ animationDelay: '140ms' }}>
        <div className="section-header">
          <Server size={16} className="section-icon" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }} className="gold-text">Client & Proxy</h3>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="stat-label">Dark Ages Client Path</span>
            <div className="flex gap-2 mt-1.5">
              <input
                type="text"
                value={clientPath}
                onChange={(e) => setClientPath(e.target.value)}
                className="input-field flex-1"
              />
              <button
                onClick={async () => {
                  const api = window.merchantMode;
                  if (!api) return;
                  const selected = await api.launcher.browse();
                  if (selected) setClientPath(selected);
                }}
                className="btn-secondary px-4 py-2 rounded-lg text-sm"
              >
                Browse
              </button>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Server" value="da0.kru.com:2610" disabled />
            <Field label="Local Proxy Port" value="2615" disabled />
          </div>
        </div>
      </div>

      {/* Bot Clients */}
      <div className="section-card animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="section-header">
          <Bot size={16} className="section-icon" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }} className="gold-text">Bot Clients</h3>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          Configure your bot client to connect to the address below instead of the game server. Bot clients are detected automatically when they connect.
        </p>
        <label className="block">
          <span className="stat-label">Proxy Address</span>
          <div className="flex gap-2 mt-1.5">
            <input
              type="text"
              value="localhost:2615"
              disabled
              className="input-field flex-1"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText('localhost:2615');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="btn-secondary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"
            >
              {copied ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </label>
      </div>

      {/* Auto-Reply Whispers */}
      <div className="section-card animate-slide-up" style={{ animationDelay: '260ms' }}>
        <div className="section-header">
          <MessageSquare size={16} className="section-icon" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }} className="gold-text">Auto-Reply Whispers</h3>
        </div>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--color-surface-200)',
            border: '1px solid var(--color-surface-500)',
            transition: 'border-color 200ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-surface-500)'; }}
        >
          <div>
            <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>Enable auto-reply</span>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              Automatically whisper back when someone messages you about a listing
            </p>
          </div>
          <div
            className="toggle-track"
            style={{
              background: autoReplyEnabled
                ? 'linear-gradient(135deg, #dbb85e, #b8973e)'
                : 'var(--color-surface-500)',
              marginLeft: 16,
            }}
          >
            <div className="toggle-thumb" style={{ left: autoReplyEnabled ? 22 : 2 }} />
          </div>
        </div>
        {autoReplyEnabled && (
          <div className="space-y-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-surface-500)' }}>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              Use {'{item}'}, {'{price}'}, and {'{wanted}'} (trade) as placeholders.
            </p>
            <Field label="Item available (selling)" value={replyAvailable} onChange={setReplyAvailable} />
            <Field label="Item not found" value={replyNotFound} onChange={setReplyNotFound} />
            <Field label="Buying reply" value={replyBuying} onChange={setReplyBuying} />
            <Field label="Trade reply" value={replyTrade} onChange={setReplyTrade} />
          </div>
        )}
      </div>

      {/* Trade Settings */}
      <div className="section-card animate-slide-up" style={{ animationDelay: '320ms' }}>
        <div className="section-header">
          <Timer size={16} className="section-icon" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }} className="gold-text">Trade Settings</h3>
        </div>
        <label className="block">
          <span className="stat-label">Exchange timeout (seconds)</span>
          <input
            type="number"
            value={exchangeTimeout}
            onChange={(e) => setExchangeTimeout(e.target.value)}
            min="10"
            max="300"
            className="input-field block w-full mt-1.5"
          />
        </label>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange?: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="stat-label">{label}</span>
      <input
        type="text"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        className="input-field block w-full mt-1.5"
      />
    </label>
  );
}
