import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import MarketOverview from '../components/MarketOverview.jsx';
import RankedTable from '../components/RankedTable.jsx';
import LikelihoodGauge from '../components/LikelihoodGauge.jsx';
import SignalBadge from '../components/SignalBadge.jsx';
import CoinIcon from '../components/CoinIcon.jsx';
import { formatPrice, formatPct, changeClass } from '../format.js';

const SIGNAL_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'buy', label: 'Invest / Lean invest', match: ['invest', 'lean-invest'] },
  { key: 'hold', label: 'Hold', match: ['hold'] },
  { key: 'avoid', label: 'Avoid / Lean avoid', match: ['avoid', 'lean-avoid'] },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [hideStable, setHideStable] = useState(true);
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    try {
      const [c, o] = await Promise.all([api.coins(limit), api.overview()]);
      setData(c);
      setOverview(o);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const coins = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const f = SIGNAL_FILTERS.find((s) => s.key === filter);
    return data.coins.filter(
      (c) =>
        (!hideStable || !c.isStablecoin) &&
        (!q || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)) &&
        (!f?.match || f.match.includes(c.signal.key))
    );
  }, [data, query, filter, hideStable]);

  const ranked = data?.coins.filter((c) => !c.isStablecoin) || [];
  const top = ranked.slice(0, 3);
  const bottom = ranked.slice(-3).reverse();
  const avg = ranked.length ? Math.round(ranked.reduce((s, c) => s + c.likelihood, 0) / ranked.length) : 50;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Crypto sentiment signals</h1>
          <p className="muted">
            Every coin ranked by the likelihood that investing now is advisable — blending news, social chatter, market mood, momentum and technicals.
          </p>
        </div>
        {data && (
          <div className="updated small muted">
            Updated {new Date(data.updatedAt).toLocaleTimeString()} · {data.sources.newsArticles} articles · {data.sources.socialPosts} posts analyzed
          </div>
        )}
      </div>

      {error && <div className="alert error">Couldn't load data: {error}. Is the API server running on port 4000?</div>}

      <MarketOverview overview={overview} />

      {loading && !data ? (
        <div className="card loading-card"><div className="spinner" /> Gathering market, news and social data…</div>
      ) : data && (
        <>
          <section className="highlights">
            <div className="card market-gauge">
              <h3>Market-wide likelihood</h3>
              <LikelihoodGauge value={avg} size={220} />
              <div className="small muted center">Average across {ranked.length} non-stablecoin assets</div>
            </div>
            <Picks title="Top opportunities" coins={top} />
            <Picks title="Weakest signals" coins={bottom} />
          </section>

          <section className="card">
            <div className="toolbar">
              <input className="search" placeholder="Search coin or symbol…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search coins" />
              <div className="seg">
                {SIGNAL_FILTERS.map((f) => (
                  <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>{f.label}</button>
                ))}
              </div>
              <label className="check">
                <input type="checkbox" checked={hideStable} onChange={(e) => setHideStable(e.target.checked)} /> Hide stablecoins
              </label>
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} aria-label="Number of coins">
                {[25, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}
              </select>
            </div>
            <RankedTable coins={coins} />
          </section>
        </>
      )}
    </div>
  );
}

function Picks({ title, coins }) {
  return (
    <div className="card picks">
      <h3>{title}</h3>
      {coins.map((c) => (
        <Link key={c.id} to={`/coin/${c.id}`} className="pick">
          <CoinIcon src={c.image} symbol={c.symbol} size={30} />
          <div className="pick-main">
            <div className="coin-name">{c.name} <span className="muted small">{c.symbol}</span></div>
            <div className="small mono">
              {formatPrice(c.price)} <span className={changeClass(c.change24h)}>{formatPct(c.change24h, 1)}</span>
            </div>
          </div>
          <div className="pick-side">
            <div className="pick-pct">{c.likelihood}%</div>
            <SignalBadge signal={c.signal} />
          </div>
        </Link>
      ))}
    </div>
  );
}
