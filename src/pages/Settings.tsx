import { useState, useEffect } from 'react';
import { Save, Check, Copy } from 'lucide-react';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold gold-text">Settings</h2>
          <div
            className="mt-2"
            style={{
              width: 80,
              height: 1,
              background: 'linear-gradient(90deg, var(--color-gold-400), transparent)',
            }}
          />
        </div>
        <button
          onClick={handleSave}
          className="btn-primary px-4 py-2 rounded-md text-sm"
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

      <Section title="Client & Proxy">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
            Dark Ages Client Path
          </span>
          <div className="flex gap-2 mt-1">
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
              className="btn-secondary px-3 py-2 rounded-md text-sm"
            >
              Browse
            </button>
          </div>
        </label>
        <Field label="Server" value="da0.kru.com:2610" disabled />
        <Field label="Local Proxy Port" value="2615" disabled />
      </Section>

      <Section title="Bot Clients">
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Configure your bot client to connect to the address below instead of the game server. Bot clients are detected automatically when they connect.
        </p>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
            Proxy Address
          </span>
          <div className="flex gap-2 mt-1">
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
              className="btn-secondary px-3 py-2 rounded-md text-sm flex items-center gap-1"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </label>
      </Section>

      <Section title="Auto-Reply Whispers">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
        >
          <div>
            <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Enable auto-reply</span>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Automatically whisper back when someone messages you about a listing
            </p>
          </div>
          <div
            className="w-11 h-6 rounded-full relative flex-shrink-0 ml-4"
            style={{
              background: autoReplyEnabled
                ? 'linear-gradient(135deg, #dbb85e, #b8973e)'
                : 'var(--color-surface-500)',
              transition: 'background 200ms ease',
            }}
          >
            <div
              className="w-5 h-5 rounded-full absolute"
              style={{
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                top: 2,
                left: autoReplyEnabled ? 22 : 2,
                transition: 'left 200ms ease',
              }}
            />
          </div>
        </div>
        {autoReplyEnabled && (
          <div className="space-y-3 mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-surface-500)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Use {'{item}'}, {'{price}'}, and {'{wanted}'} (trade) as placeholders.
            </p>
            <Field
              label="Item available (selling)"
              value={replyAvailable}
              onChange={setReplyAvailable}
            />
            <Field
              label="Item not found"
              value={replyNotFound}
              onChange={setReplyNotFound}
            />
            <Field
              label="Buying reply"
              value={replyBuying}
              onChange={setReplyBuying}
            />
            <Field
              label="Trade reply"
              value={replyTrade}
              onChange={setReplyTrade}
            />
          </div>
        )}
      </Section>

      <Section title="Trade Settings">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
            Exchange timeout (seconds)
          </span>
          <input
            type="number"
            value={exchangeTimeout}
            onChange={(e) => setExchangeTimeout(e.target.value)}
            min="10"
            max="300"
            className="input-field block w-full mt-1"
          />
        </label>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 space-y-3 animate-fade-in">
      <h3 className="stat-label">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange?: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        className="input-field block w-full mt-1"
      />
    </label>
  );
}
