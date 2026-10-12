// Deterministic synthetic data so the app runs fully offline (`npm run demo`) and keeps working
// when upstream APIs are rate-limited or unreachable. Prices are illustrative, NOT real quotes.
import { lexiconScore } from './sentiment.js';

const COINS = [
  // id, symbol, name, base price, daily vol
  ['bitcoin', 'BTC', 'Bitcoin', 112000, 0.024],
  ['ethereum', 'ETH', 'Ethereum', 4100, 0.033],
  ['tether', 'USDT', 'Tether', 1, 0],
  ['ripple', 'XRP', 'XRP', 2.6, 0.045],
  ['binancecoin', 'BNB', 'BNB', 980, 0.028],
  ['solana', 'SOL', 'Solana', 205, 0.045],
  ['usd-coin', 'USDC', 'USDC', 1, 0],
  ['dogecoin', 'DOGE', 'Dogecoin', 0.22, 0.055],
  ['tron', 'TRX', 'TRON', 0.33, 0.025],
  ['cardano', 'ADA', 'Cardano', 0.74, 0.048],
  ['chainlink', 'LINK', 'Chainlink', 19.5, 0.05],
  ['avalanche-2', 'AVAX', 'Avalanche', 27, 0.052],
  ['stellar', 'XLM', 'Stellar', 0.36, 0.045],
  ['sui', 'SUI', 'Sui', 3.2, 0.06],
  ['hedera-hashgraph', 'HBAR', 'Hedera', 0.21, 0.05],
  ['litecoin', 'LTC', 'Litecoin', 105, 0.04],
  ['shiba-inu', 'SHIB', 'Shiba Inu', 0.0000125, 0.058],
  ['polkadot', 'DOT', 'Polkadot', 3.9, 0.05],
  ['uniswap', 'UNI', 'Uniswap', 7.8, 0.055],
  ['aptos', 'APT', 'Aptos', 4.6, 0.058],
  ['near', 'NEAR', 'NEAR Protocol', 2.7, 0.058],
  ['cosmos', 'ATOM', 'Cosmos Hub', 4.3, 0.05],
  ['pepe', 'PEPE', 'Pepe', 0.0000098, 0.07],
  ['render-token', 'RENDER', 'Render', 3.4, 0.062],
];

const HOURS = 365 * 24;
const HOUR = 3600_000;

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

let memo = { hour: -1, series: new Map() };

function hourlySeries(def) {
  const hourIdx = Math.floor(Date.now() / HOUR);
  if (memo.hour !== hourIdx) memo = { hour: hourIdx, series: new Map() };
  if (memo.series.has(def[0])) return memo.series.get(def[0]);

  const [id, , , base, vol] = def;
  const r = rng(hash(id));
  const end = hourIdx * HOUR;
  const out = new Array(HOURS);
  if (vol === 0) {
    for (let i = 0; i < HOURS; i++) out[i] = [end - (HOURS - 1 - i) * HOUR, 1 + 0.0007 * gauss(r)];
  } else {
    const hv = vol / Math.sqrt(24);
    const drift = (r() - 0.45) * vol * 0.06 / 24;
    let p = 1, regime = 0;
    const raw = [];
    for (let i = 0; i < HOURS; i++) {
      if (i % 240 === 0) regime = (r() - 0.5) * hv * 0.25; // multi-week regimes make charts interesting
      p *= Math.exp(drift + regime + hv * gauss(r));
      raw.push(p);
    }
    const target = base * Math.exp(0.03 * Math.sin(hourIdx / 9 + (hash(id) % 100)));
    const k = target / raw.at(-1);
    for (let i = 0; i < HOURS; i++) out[i] = [end - (HOURS - 1 - i) * HOUR, raw[i] * k];
  }
  memo.series.set(id, out);
  return out;
}

const pct = (a, b) => (b ? (a / b - 1) * 100 : null);

function summary(def, idx) {
  const [id, symbol, name, , vol] = def;
  const s = hourlySeries(def);
  const price = s.at(-1)[1];
  const at = (h) => s[s.length - 1 - h][1];
  const last24 = s.slice(-24).map((p) => p[1]);
  const supply = (1e9 / (def[3] || 1)) * Math.pow(0.55, idx) * 2000; // decreasing market caps by rank
  return {
    id, symbol, name,
    image: null,
    price,
    marketCap: price * supply,
    rank: idx + 1,
    volume24h: price * supply * (0.03 + vol),
    high24h: Math.max(...last24),
    low24h: Math.min(...last24),
    change1h: pct(price, at(1)),
    change24h: pct(price, at(24)),
    change7d: pct(price, at(168)),
    change30d: pct(price, at(720)),
    ath: Math.max(...s.map((p) => p[1])) * 1.15,
    athChangePct: null,
    circulatingSupply: supply,
    maxSupply: null,
    sparkline: s.slice(-168).map((p) => p[1]),
    lastUpdated: new Date().toISOString(),
  };
}

export function getMarkets(limit) {
  return COINS.slice(0, limit).map((d, i) => {
    const c = summary(d, i);
    c.athChangePct = pct(c.price, c.ath);
    return c;
  });
}

export function getCoin(id) {
  const idx = COINS.findIndex((c) => c[0] === id);
  if (idx < 0) return null;
  const c = summary(COINS[idx], idx);
  const r = rng(hash(id + ':meta'));
  return {
    ...c,
    athChangePct: pct(c.price, c.ath),
    description: `${c.name} (${c.symbol}) — demo mode. Prices, headlines and posts shown are synthetic sample data generated locally so the app works offline. Connect to the internet (and unset MOCK_DATA) for live CoinGecko, news and Reddit data.`,
    homepage: null,
    subreddit: null,
    categories: ['Demo data'],
    votesUpPct: c.symbol === 'USDT' || c.symbol === 'USDC' ? null : Math.round(50 + 35 * r() + (c.change7d ?? 0)),
    community: { redditSubscribers: Math.round(1e5 + r() * 4e6), twitterFollowers: Math.round(2e5 + r() * 6e6), telegramUsers: null },
    genesisDate: null,
  };
}

export function getHistory(id, days) {
  const def = COINS.find((c) => c[0] === id);
  if (!def) return null;
  const s = hourlySeries(def).slice(-days * 24 - 1);
  const step = days > 90 ? 24 : 1;
  const prices = s.filter((_, i) => (s.length - 1 - i) % step === 0);
  return { prices, volumes: prices.map(([t, p]) => [t, p * 1e6 * (1 + Math.abs(Math.sin(t / 1e8)))]) };
}

const POS = [
  '{name} rallies as institutional inflows hit a fresh record',
  'Analysts turn bullish on {name} after successful network upgrade',
  '{name} ({SYM}) breaks out above key resistance with strong volume',
  'Major exchange partnership boosts {name} adoption',
  'Whales accumulate {SYM} as on-chain activity climbs',
];
const NEG = [
  '{name} slumps as traders brace for a regulatory crackdown',
  '{SYM} faces selloff after heavy long liquidations',
  'Security concerns weigh on {name} after exploit report on a bridge',
  '{name} drops below support amid fading demand',
  'Outflows from {name} investment products continue for a third week',
];
const NEU = [
  '{name} developers outline roadmap for next quarter',
  'What to watch for {name} ({SYM}) this week',
  '{name} trading volume steady as market awaits macro data',
];
const POSTS_POS = ['Why I keep stacking {SYM} — fundamentals look great', '{name} ecosystem growth is underrated, bullish long term', 'Daily reminder: {SYM} adoption keeps climbing'];
const POSTS_NEG = ['Is anyone else worried about {name}? Chart looks weak', 'Sold my {SYM} today, too much risk right now', '{name} keeps dumping, what is going on?'];

function fill(t, c) { return t.replaceAll('{name}', c.name).replaceAll('{SYM}', c.symbol); }

function textsFor(kind) {
  const day = Math.floor(Date.now() / 86400_000);
  const out = [];
  COINS.forEach((def, i) => {
    if (def[4] === 0) return;
    const c = summary(def, i);
    const r = rng(hash(def[0] + kind + day));
    const bias = Math.tanh((c.change7d ?? 0) / 10) * 0.35 + (r() - 0.5) * 0.5;
    const n = kind === 'news' ? 3 + Math.floor(r() * 6) : 2 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      const roll = r() + bias * 0.6;
      const pool = kind === 'news' ? (roll > 0.62 ? POS : roll < 0.38 ? NEG : NEU) : roll > 0.5 ? POSTS_POS : POSTS_NEG;
      const title = fill(pool[Math.floor(r() * pool.length)], c);
      const publishedAt = Date.now() - Math.floor(r() * 72) * HOUR - Math.floor(r() * HOUR);
      const item = kind === 'news'
        ? { id: `${def[0]}-n${k}`, title, summary: '', link: null, source: 'Demo Wire', publishedAt }
        : { id: `${def[0]}-p${k}`, title, text: '', score: Math.floor(r() * 900), comments: Math.floor(r() * 300), subreddit: 'CryptoCurrency', link: null, publishedAt };
      item.sentiment = lexiconScore(title);
      out.push(item);
    }
  });
  return out.sort((a, b) => b.publishedAt - a.publishedAt);
}

export const getNews = () => textsFor('news');
export const getPosts = () => textsFor('posts');

export function getFearGreed() {
  const day = Math.floor(Date.now() / 86400_000);
  const history = [];
  for (let i = 29; i >= 0; i--) {
    const v = Math.round(52 + 18 * Math.sin((day - i) / 6) + 6 * (rng(day - i)() - 0.5));
    history.push({ ts: (day - i) * 86400_000, value: v, classification: classify(v) });
  }
  const latest = history.at(-1);
  return { value: latest.value, classification: latest.classification, history };
}
export function classify(v) {
  return v < 25 ? 'Extreme Fear' : v < 45 ? 'Fear' : v <= 55 ? 'Neutral' : v < 75 ? 'Greed' : 'Extreme Greed';
}

export function getTrending() {
  return getMarkets(COINS.length)
    .filter((c) => !['USDT', 'USDC'].includes(c.symbol))
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 7)
    .map((c) => ({ id: c.id, name: c.name, symbol: c.symbol, thumb: null, marketCapRank: c.rank }));
}

export function getGlobal() {
  const m = getMarkets(COINS.length);
  const total = m.reduce((s, c) => s + c.marketCap, 0);
  return {
    totalMarketCap: total * 1.25,
    totalVolume: m.reduce((s, c) => s + c.volume24h, 0) * 1.3,
    btcDominance: (m[0].marketCap / (total * 1.25)) * 100,
    ethDominance: (m[1].marketCap / (total * 1.25)) * 100,
    marketCapChange24h: m[0].change24h * 0.8,
    activeCryptos: 17000,
  };
}
