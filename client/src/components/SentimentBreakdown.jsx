// Diverging bars: each factor's bearish(-1)…bullish(+1) reading, weight, and evidence confidence.
export default function SentimentBreakdown({ components = [] }) {
  return (
    <div className="card">
      <div className="card-head"><h3>What's driving the signal</h3></div>
      <div className="factors">
        {components.map((c) => {
          const pct = Math.abs(c.value) * 50;
          const pos = c.value >= 0;
          return (
            <div key={c.key} className="factor" style={{ opacity: c.confidence < 0.15 ? 0.5 : 1 }}>
              <div className="factor-top">
                <span className="factor-label">{c.label}</span>
                <span className="small muted">weight {Math.round(c.weight * 100)}% · confidence {Math.round(c.confidence * 100)}%</span>
              </div>
              <div className="dbar">
                <div className="dbar-mid" />
                <div className="dbar-fill" style={{ width: `${pct}%`, left: pos ? '50%' : `${50 - pct}%`, background: pos ? 'var(--up)' : 'var(--down)' }} />
              </div>
              <div className="factor-bottom">
                <span className="small muted">{c.detail}</span>
                <span className={`mono small ${pos ? 'up' : 'down'}`}>{c.value >= 0 ? '+' : ''}{c.value.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
