import { useState, useEffect } from 'react';
import { LayoutDashboard, ArrowLeftRight, Settings as SettingsIcon, Play, Loader2, List, Info, MessageCircle } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import Whispers from './pages/Whispers';
import Settings from './pages/Settings';
import About from './pages/About';
import TransactionLog from './components/TransactionLog';
import PacketSniffer from './components/PacketSniffer';
import ConnectionStatus from './components/ConnectionStatus';
import CharacterTabs from './components/CharacterTabs';
import AllMerchantsView from './components/AllMerchantsView';
import UpdateBanner from './components/UpdateBanner';

type Page = 'dashboard' | 'listings' | 'whispers' | 'transactions' | 'sniffer' | 'settings' | 'about';

const NAV_ITEMS: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'listings', label: 'Listings', icon: List },
  { page: 'whispers', label: 'Whispers', icon: MessageCircle },
  { page: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { page: 'settings', label: 'Settings', icon: SettingsIcon },
  { page: 'about', label: 'About', icon: Info },
];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [proxyStatus, setProxyStatus] = useState('disconnected');
  const [characters, setCharacters] = useState<string[]>([]);
  const [activeCharacter, setActiveCharacter] = useState<string | null>(null);
  const [characterStates, setCharacterStates] = useState<Record<string, string>>({});
  const [characterTypes, setCharacterTypes] = useState<Record<string, 'launched' | 'bot'>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [snifferLog, setSnifferLog] = useState<any[]>([]);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');
  const [allMerchantsMode, setAllMerchantsMode] = useState(false);
  const [allMerchants, setAllMerchants] = useState<GlobalMerchantData[]>([]);

  useEffect(() => {
    const api = window.merchantMode;
    if (!api) return;

    api.proxy.getStatus().then(setProxyStatus);
    api.merchants.getAll().then(setAllMerchants);
    api.merchants.onUpdated(setAllMerchants);
    api.characters.list().then((entries) => {
      const names = entries.map((e) => e.name);
      setCharacters(names);
      setCharacterTypes(Object.fromEntries(entries.map((e) => [e.name, e.connectionType])));
      if (names.length > 0 && !activeCharacter) {
        setActiveCharacter(names[0]);
      }
    });
    api.transactions.getAll().then(setTransactions);
    api.sniffer.getLog().then(setSnifferLog);

    api.proxy.onStatus(setProxyStatus);

    api.characters.onConnected((data) => {
      setCharacters((prev) => {
        if (prev.includes(data.name)) return prev;
        return [...prev, data.name];
      });
      setCharacterTypes((prev) => ({ ...prev, [data.name]: data.connectionType }));
      // Only auto-select if no character is active and not in all-merchants mode
      setActiveCharacter((prev) => prev ?? data.name);
    });

    api.characters.onDisconnected((name) => {
      setCharacters((prev) => prev.filter((c) => c !== name));
      setActiveCharacter((prev) => {
        if (prev === name) return null;
        return prev;
      });
      setCharacterStates((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      setCharacterTypes((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    });

    api.engine.onState((data) => {
      setCharacterStates((prev) => ({ ...prev, [data.characterName]: data.state }));
    });

    api.engine.onTransaction((tx) => {
      setTransactions((prev) => [tx, ...prev]);
    });

    api.proxy.onPacket((pkt) => {
      setSnifferLog((prev) => {
        const next = [...prev, pkt];
        return next.length > 500 ? next.slice(-500) : next;
      });
    });

    return () => {
      api.removeAllListeners();
    };
  }, []);

  // Auto-select first character if activeCharacter becomes null but characters exist
  useEffect(() => {
    if (!activeCharacter && !allMerchantsMode && characters.length > 0) {
      setActiveCharacter(characters[0]);
    }
  }, [characters, activeCharacter, allMerchantsMode]);

  const engineState = activeCharacter ? (characterStates[activeCharacter] ?? 'IDLE') : 'IDLE';

  return (
    <div className="flex h-screen" style={{ background: 'var(--color-surface-100)' }}>
      {/* Sidebar */}
      <nav
        className="w-56 flex flex-col border-r"
        style={{
          background: 'linear-gradient(180deg, var(--color-surface-300) 0%, var(--color-surface-200) 100%)',
          borderColor: 'var(--color-surface-500)',
        }}
      >
        <div className="p-4 pb-3">
          <h1 className="text-lg font-bold gold-text flex items-center gap-2">
            <img src="items/4529.png" alt="" className="h-5 w-auto" style={{ imageRendering: 'pixelated' }} />
            Merchant Mode
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
            by AislingExchange.com
          </p>
          <div
            className="mt-2"
            style={{
              width: 40,
              height: 2,
              borderRadius: 1,
              background: 'linear-gradient(90deg, var(--color-gold-400), transparent)',
            }}
          />
        </div>

        <div className="flex-1 px-2 flex flex-col gap-1">
          {NAV_ITEMS.map(({ page: p, label, icon: Icon }) => {
            const isActive = page === p;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="relative flex items-center gap-3 text-left px-3 py-2.5 rounded-md text-sm"
                style={{
                  background: isActive ? 'var(--color-surface-400)' : 'transparent',
                  color: isActive ? 'var(--color-gold-400)' : 'var(--color-text-secondary)',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--color-surface-400)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }
                }}
              >
                {isActive && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2"
                    style={{
                      width: 3,
                      height: '60%',
                      borderRadius: 2,
                      background: 'var(--color-gold-400)',
                    }}
                  />
                )}
                <Icon size={16} />
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="px-3 pb-4 space-y-3">
          <div className="flex justify-center">
            <ConnectionStatus proxyStatus={proxyStatus} engineState={engineState} />
          </div>
          {/* Gradient separator */}
          <div
            style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, var(--color-surface-600), transparent)',
            }}
          />
          <button
            onClick={async () => {
              setLaunching(true);
              setLaunchError('');
              const api = window.merchantMode;
              if (!api) return;
              const result = await api.launcher.launch();
              setLaunching(false);
              if (!result.success) {
                setLaunchError(result.error || 'Launch failed');
              }
            }}
            disabled={launching}
            className="btn-primary w-full px-3 py-2 rounded-md text-sm"
            style={{ opacity: launching ? 0.6 : 1 }}
          >
            {launching ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {launching ? 'Launching...' : 'Launch Client'}
          </button>
          {launchError && (
            <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{launchError}</p>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <UpdateBanner />
        {/* Character Tabs */}
        {(page === 'dashboard' || page === 'listings') && (
          <CharacterTabs
            characters={characters}
            activeCharacter={activeCharacter}
            onSelect={(name) => { setAllMerchantsMode(false); setActiveCharacter(name); }}
            onSelectAll={() => { setAllMerchantsMode(true); setActiveCharacter(null); }}
            isAllSelected={allMerchantsMode}
            allMerchantsCount={allMerchants.length}
            characterStates={characterStates}
            characterTypes={characterTypes}
          />
        )}

        <main className="flex-1 overflow-auto p-6">
          {page === 'dashboard' && allMerchantsMode && (
            <AllMerchantsView merchants={allMerchants} proxyStatus={proxyStatus} />
          )}
          {page === 'dashboard' && !allMerchantsMode && (
            <Dashboard
              proxyStatus={proxyStatus}
              engineState={engineState}
              characterName={activeCharacter}
            />
          )}
          {page === 'listings' && (
            <Listings
              characterName={activeCharacter}
              allMerchantsMode={allMerchantsMode}
              allMerchants={allMerchants}
            />
          )}
          {page === 'whispers' && (
            <Whispers characters={characters} />
          )}
          {page === 'transactions' && (
            <div className="flex flex-col h-full">
              <div className="space-y-4 pb-3">
                <h2 className="text-xl font-semibold gold-text">Transactions</h2>
                <div
                  style={{
                    width: 80,
                    height: 1,
                    background: 'linear-gradient(90deg, var(--color-gold-400), transparent)',
                  }}
                />
              </div>
              <div className="flex-1 min-h-0">
                <TransactionLog transactions={transactions} />
              </div>
            </div>
          )}
          {page === 'sniffer' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold gold-text">Packet Sniffer</h2>
              <PacketSniffer packets={snifferLog} />
            </div>
          )}
          {page === 'settings' && <Settings />}
          {page === 'about' && <About />}
        </main>
      </div>
    </div>
  );
}
