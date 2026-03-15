export default function About() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold gold-text">About</h2>
        <div
          className="mt-2"
          style={{
            width: 80,
            height: 1,
            background: 'linear-gradient(90deg, var(--color-gold-400), transparent)',
          }}
        />
      </div>

      {/* Merchant Mode */}
      <div className="card p-6 space-y-4 animate-fade-in">
        <h3 className="text-lg font-bold gold-text">Merchant Mode</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Merchant Mode is an AFK merchant automation tool for Dark Ages. It acts as a local proxy
          between your game client and the server, intercepting and handling trade-related packets
          so you can set up buy and sell listings and walk away. When another player whispers your
          character with a matching request, Merchant Mode automatically handles the exchange window,
          places the items or gold, and completes the trade on your behalf.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          The tool supports multiple characters simultaneously, real-time inventory tracking,
          stackable item sales, price parsing with shorthand notation, and a full transaction log
          so you never lose track of what was traded and when.
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          Based on an original idea from <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Vamistle</span>.
        </p>
      </div>

      <Divider />

      {/* AislingExchange.com */}
      <div className="card p-6 space-y-4 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <h3 className="text-lg font-bold gold-text">AislingExchange.com</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          AislingExchange.com is a community-driven marketplace and resource hub for Dark Ages players.
          It provides a centralized platform where players can browse, list, and search for items
          across the game's economy — bringing visibility and price discovery to a trade system that
          has traditionally relied on in-game whispers, forums, and word of mouth.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Whether you're looking for rare equipment, tracking market trends, or trying to find the
          right buyer for your loot, AislingExchange serves as the connective tissue between
          Dark Ages merchants and the broader community. Merchant Mode is designed to work
          hand-in-hand with the exchange, bridging the gap between online listings and in-game trades.
        </p>
      </div>

      <Divider />

      {/* Lancelot */}
      <div className="card p-6 space-y-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <h3 className="text-lg font-bold gold-text">About Lancelot</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Lancelot is a long-time Dark Ages player and the developer behind AislingExchange.com
          and Merchant Mode. His projects are focused on building tools that improve the quality of
          life for the Dark Ages community — from trade automation to market infrastructure.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          His work includes reverse engineering the Dark Ages network protocol, building proxy-based
          tools that interact with the game client, and creating web platforms that give players
          better access to information about the game's economy and mechanics. All of these projects
          share a common goal: making Dark Ages more accessible and enjoyable for everyone who still
          calls Temuair home.
        </p>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, var(--color-surface-500), transparent)',
      }}
    />
  );
}
