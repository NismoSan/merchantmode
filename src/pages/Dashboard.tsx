import { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import WhisperQueue from '../components/WhisperQueue';
import InventoryView from '../components/InventoryView';
import CreateListingModal from '../components/CreateListingModal';
import type { PrefillItem } from '../components/CreateListingModal';

interface Props {
  proxyStatus: string;
  engineState: string;
  characterName: string | null;
}

export default function Dashboard({ proxyStatus, engineState, characterName }: Props) {
  const [listings, setListings] = useState<any[]>([]);
  const [whispers, setWhispers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [gold, setGold] = useState(0);
  const [todayTrades, setTodayTrades] = useState(0);
  const [modalItem, setModalItem] = useState<PrefillItem | null>(null);

  useEffect(() => {
    const api = window.merchantMode;
    if (!api || !characterName) {
      setListings([]);
      setWhispers([]);
      setInventory([]);
      setGold(0);
      setTodayTrades(0);
      return;
    }

    loadListings();
    api.engine.getWhispers(characterName).then(setWhispers);
    api.inventory.get(characterName).then(setInventory);
    api.inventory.getGold(characterName).then(setGold);

    // Count today's trades
    const today = new Date().toISOString().split('T')[0];
    api.transactions.getByDate(today, today).then((txs) => setTodayTrades(txs.length));

    // Listen for events scoped to this character
    const handleWhisper = (w: any) => {
      if (w.characterName === characterName) {
        setWhispers((prev) => [...prev, w]);
      }
    };
    const handleInventoryUpdate = (data: any) => {
      if (data.characterName === characterName) {
        setInventory(data.items);
      }
    };
    const handleTransaction = (tx: any) => {
      if (!tx.characterName || tx.characterName === characterName) {
        setTodayTrades((prev) => prev + 1);
        loadListings();
      }
    };

    const handleGoldUpdate = (data: any) => {
      if (data.characterName === characterName) {
        setGold(data.gold);
      }
    };

    api.engine.onWhisper(handleWhisper);
    api.inventory.onUpdate(handleInventoryUpdate);
    api.inventory.onGoldUpdate(handleGoldUpdate);
    api.engine.onTransaction(handleTransaction);

    return () => {
      api.removeAllListeners();
    };
  }, [characterName]);

  async function loadListings() {
    const api = window.merchantMode;
    if (!api || !characterName) return;
    const all = await api.listings.getAll(characterName);
    setListings(all);
  }

  function handleInventoryItemClick(item: any) {
    setModalItem({ name: item.name, quantity: item.quantity, isStackable: item.isStackable });
  }

  const activeListings = listings.filter((l: any) => l.status === 'ACTIVE').length;
  const connected = proxyStatus === 'connected';

  if (!characterName) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
        <Monitor size={48} style={{ color: 'var(--color-gold-600)' }} />
        <div className="text-center">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No character selected
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Launch a client to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          <span className="gold-text">Dashboard</span>
          <span className="ml-2 text-base font-normal" style={{ color: 'var(--color-text-secondary)' }}>
            — {characterName}
          </span>
        </h2>
        <div
          className="mt-2"
          style={{
            width: 80,
            height: 1,
            background: 'linear-gradient(90deg, var(--color-gold-400), transparent)',
          }}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Status" value={connected ? engineState.replace(/_/g, ' ') : 'Offline'} delay={0} />
        <StatCard label="Active Listings" value={activeListings.toString()} delay={50} />
        <StatCard label="Trades Today" value={todayTrades.toString()} delay={100} />
        <StatCard label="Gold" value={formatGold(gold)} delay={150} />
      </div>

      {/* Inventory - no panel title, InventoryView has its own header */}
      <Panel noTitle>
        <InventoryView items={inventory} gold={gold} onItemClick={handleInventoryItemClick} />
      </Panel>

      {/* Whisper Queue - full width */}
      <Panel title="Whisper Queue">
        <WhisperQueue whispers={whispers} />
      </Panel>

      {modalItem && characterName && (
        <CreateListingModal
          characterName={characterName}
          prefillItem={modalItem}
          onClose={() => setModalItem(null)}
          onCreated={loadListings}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div
      className="card relative overflow-hidden p-5 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: 2,
          background: 'linear-gradient(90deg, var(--color-gold-400), var(--color-gold-600), transparent)',
        }}
      />
      <p className="stat-label mb-1">{label}</p>
      <p
        className="text-2xl font-bold"
        style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
      >
        {value}
      </p>
    </div>
  );
}

function Panel({ title, noTitle, children }: { title?: string; noTitle?: boolean; children: React.ReactNode }) {
  return (
    <div className="card p-4 animate-fade-in">
      {!noTitle && title && (
        <h3 className="stat-label mb-3">{title}</h3>
      )}
      {children}
    </div>
  );
}

function formatGold(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}
