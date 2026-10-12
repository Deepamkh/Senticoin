import { Link } from 'react-router-dom';
import { formatCompact, formatPct, changeClass } from '../format.js';
import CoinIcon from './CoinIcon.jsx';

function fgColor(v) {
  if (v < 25) return '#d93636';
  if (v < 45) return '#e0631c';
  if (v <= 55) return '#c97a06';
  if (v < 75) return '#5fa317';
  return '#15964a';
}

export default function MarketOverview({ overview }) {
  if (!overview) return null;
  const { fearGreed: fg, global: g, trending = [] } = overview;
  return (
    <section className="overview">
      <div className="card stat">
        <div className="stat-label">Fear &amp; Greed Index</div>
        {fg ? (
          <>
            <div className="fg-row">
              <span className="stat-value" style={{ color: fgColor(fg.value) }}>{fg.value}</span>
              <span className="fg-class" style={{ color: fgColor(fg.value) }}>{fg.classification}</span>
            </div>
            <div className="fg-track"><div className="fg-dot" style={{ left: `${fg.value}%`, background: fgColor(fg.value) }} /></div>
          </>
        ) : <div className="muted">Unavailable</div>}
      </div>
      <div className="card stat">
        <div className="stat-label">Total market cap</div>
        <div className="stat-value">{formatCompact(g?.totalMarketCap)}</div>
        <div className={`small mono ${changeClass(g?.marketCapChange24h)}`}>{formatPct(g?.marketCapChange24h)} 24h</div>
      </div>
      <div className="card stat">
        <div className="stat-label">BTC dominance</div>
        <div className="stat-value">{g?.btcDominance ? `${g.btcDominance.toFixed(1)}%` : '—'}</div>
        <div className="small muted">24h volume {formatCompact(g?.totalVolume)}</div>
      </div>
      <div className="card stat trending">
        <div className="stat-label">🔥 Trending now</div>
        <div className="trend-list">
          {trending.slice(0, 6).map((t) => (
            <Link key={t.id} to={`/coin/${t.id}`} className="trend-chip">
              <CoinIcon src={t.thumb} symbol={t.symbol} size={18} />
              {t.symbol}
            </Link>
          ))}
          {!trending.length && <span className="muted small">No data</span>}
        </div>
      </div>
    </section>
  );
}
