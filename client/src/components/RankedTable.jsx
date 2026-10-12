import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CoinIcon from './CoinIcon.jsx';
import Sparkline from './Sparkline.jsx';
import SignalBadge from './SignalBadge.jsx';
import LikelihoodBar from './LikelihoodBar.jsx';
import { formatPrice, formatPct, formatCompact, changeClass } from '../format.js';

const COLUMNS = [
  { key: 'likelihoodRank', label: '#', numeric: true, title: 'Rank by investment likelihood' },
  { key: 'name', label: 'Coin' },
  { key: 'price', label: 'Price', numeric: true },
  { key: 'change24h', label: '24h', numeric: true },
  { key: 'change7d', label: '7d', numeric: true },
  { key: 'marketCap', label: 'Market cap', numeric: true, hideSm: true },
  { key: 'score', label: 'Sentiment', numeric: true, title: 'Combined sentiment score, 0 (very bearish) – 100 (very bullish)' },
  { key: 'likelihood', label: 'Invest likelihood', numeric: true },
  { key: 'signal', label: 'Signal' },
  { key: 'forecast', label: '7d trend & forecast', numeric: true, title: 'Last 7 days (solid) + expected next 7 days (dashed)' },
];

const sortVal = (row, key) => {
  if (key === 'forecast') return row.forecast?.expectedChangePct ?? -Infinity;
  if (key === 'signal') return row.likelihood;
  if (key === 'name') return row.name.toLowerCase();
  return row[key] ?? -Infinity;
};

export default function RankedTable({ coins }) {
  const nav = useNavigate();
  const [sort, setSort] = useState({ key: 'likelihoodRank', dir: 1 });

  const rows = useMemo(() => {
    const out = [...coins];
    out.sort((a, b) => {
      const va = sortVal(a, sort.key), vb = sortVal(b, sort.key);
      return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir;
    });
    return out;
  }, [coins, sort]);

  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: ['likelihoodRank', 'name'].includes(key) ? 1 : -1 }));

  return (
    <div className="table-wrap">
      <table className="ranked">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} className={`${c.numeric ? 'num' : ''} ${c.hideSm ? 'hide-sm' : ''}`} title={c.title}>
                <button onClick={() => toggle(c.key)} className={sort.key === c.key ? 'active' : ''}>
                  {c.label}
                  {sort.key === c.key && <span className="arrow">{sort.dir === 1 ? '▲' : '▼'}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} onClick={() => nav(`/coin/${c.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nav(`/coin/${c.id}`)}>
              <td className="num muted">{c.likelihoodRank}</td>
              <td>
                <div className="coin-cell">
                  <CoinIcon src={c.image} symbol={c.symbol} />
                  <div>
                    <div className="coin-name">{c.name}</div>
                    <div className="coin-sym">
                      {c.symbol} · #{c.rank}
                      {c.isWrapped && <span className="chip">wrapped</span>}
                    </div>
                  </div>
                </div>
              </td>
              <td className="num mono">{formatPrice(c.price)}</td>
              <td className={`num mono ${changeClass(c.change24h)}`}>{formatPct(c.change24h, 1)}</td>
              <td className={`num mono ${changeClass(c.change7d)}`}>{formatPct(c.change7d, 1)}</td>
              <td className="num mono hide-sm">{formatCompact(c.marketCap)}</td>
              <td className="num">
                <span className="score-pill" title={`${c.newsCount} news · ${c.socialCount} social mentions · ${c.confidence}% confidence`}>{c.score}</span>
              </td>
              <td className="num"><LikelihoodBar value={c.likelihood} muted={c.isStablecoin} /></td>
              <td><SignalBadge signal={c.signal} /></td>
              <td className="num">
                <div className="trend-cell">
                  <Sparkline data={c.sparkline} forecast={c.forecast?.path?.length ? scalePath(c) : []} />
                  <span className={`mono small ${changeClass(c.forecast?.expectedChangePct)}`}>{formatPct(c.forecast?.expectedChangePct, 1)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty">No coins match your filters.</div>}
    </div>
  );
}

// Forecast path is in price terms; extend sparkline with ~equal visual width (7 days ≈ same as history)
function scalePath(c) {
  const path = c.forecast.path;
  const k = Math.max(1, Math.round(c.sparkline.length / path.length));
  const out = [];
  let prev = c.sparkline.at(-1);
  for (const p of path) {
    for (let i = 1; i <= k; i++) out.push(prev + ((p - prev) * i) / k);
    prev = p;
  }
  return out;
}
