// Multi-factor scoring engine. Each factor yields value ∈ [-1, 1] (bearish→bullish) and
// confidence ∈ [0, 1] (how much evidence backs it). Factors are combined with fixed weights,
// each down-weighted by its confidence, so a coin with little coverage isn't judged on noise.

export const WEIGHTS = {
  news: 0.22,
  social: 0.18,
  momentum: 0.2,
  technical: 0.18,
  marketMood: 0.1,
  trending: 0.06,
  risk: 0.06,
};

export const LABELS = {
  news: 'News sentiment',
  social: 'Social sentiment',
  momentum: 'Price momentum',
  technical: 'Technical indicators',
  marketMood: 'Market mood (Fear & Greed)',
  trending: 'Attention / trending',
  risk: 'Volatility risk',
};

const clamp = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));
const tanh = Math.tanh;
const recencyWeight = (ts) => Math.pow(0.5, Math.max(0, (Date.now() - ts) / 3.6e6) / 48); // 48h half-life
const r2 = (x) => Math.round(x * 100) / 100;

export function buildComponents({ coin, tech, news = [], posts = [], votesUpPct = null, fearGreed = null, trendingRank = -1 }) {
  const c = {};

  // --- News ---
  if (news.length) {
    let ws = 0, s = 0, pos = 0, neg = 0;
    for (const a of news) {
      const w = recencyWeight(a.publishedAt);
      ws += w; s += w * a.sentiment;
      if (a.sentiment > 0.1) pos++; else if (a.sentiment < -0.1) neg++;
    }
    c.news = {
      value: clamp((ws ? s / ws : 0) * 1.5),
      confidence: Math.min(1, news.length / 8) * (0.5 + 0.5 * Math.min(1, ws)),
      detail: `${news.length} article${news.length > 1 ? 's' : ''} · ${pos} positive · ${neg} negative`,
    };
  } else c.news = { value: 0, confidence: 0, detail: 'No recent coverage found' };

  // --- Social ---
  {
    const parts = []; let conf = 0; const bits = [];
    if (posts.length) {
      let ws = 0, s = 0;
      for (const p of posts) {
        const w = (Math.log1p(Math.max(0, p.score) + (p.comments || 0)) + 0.5) * recencyWeight(p.publishedAt);
        ws += w; s += w * p.sentiment;
      }
      parts.push({ v: clamp((ws ? s / ws : 0) * 1.5), w: 0.65 });
      conf += 0.65 * Math.min(1, posts.length / 12);
      const reddit = posts.filter((p) => p.platform !== 'mastodon').length;
      const masto = posts.length - reddit;
      bits.push([reddit && `${reddit} Reddit`, masto && `${masto} Mastodon`].filter(Boolean).join(' + ') + ` post${posts.length > 1 ? 's' : ''}`);
    }
    if (votesUpPct != null) {
      parts.push({ v: clamp((votesUpPct - 50) / 40), w: 0.35 });
      conf += 0.35;
      bits.push(`${Math.round(votesUpPct)}% bullish community votes`);
    }
    const tw = parts.reduce((s, p) => s + p.w, 0);
    c.social = {
      value: tw ? parts.reduce((s, p) => s + p.v * p.w, 0) / tw : 0,
      confidence: conf,
      detail: bits.length ? bits.join(' · ') : 'No social discussion found',
    };
  }

  // --- Momentum ---
  {
    const ch24 = coin.change24h ?? 0, ch7 = coin.change7d ?? 0, ch30 = coin.change30d;
    let m = 0.3 * tanh(ch24 / 6) + 0.4 * tanh(ch7 / 15);
    m = ch30 != null ? m + 0.3 * tanh(ch30 / 30) : m / 0.7;
    const fmt = (x) => (x == null ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`);
    c.momentum = { value: clamp(m), confidence: coin.change7d != null ? 1 : 0.5, detail: `24h ${fmt(coin.change24h)} · 7d ${fmt(coin.change7d)} · 30d ${fmt(ch30)}` };
  }

  // --- Technicals ---
  if (tech?.price) {
    const parts = []; const bits = [];
    if (tech.rsi != null) {
      const r = tech.rsi;
      const v = r < 30 ? 0.4 + (0.6 * (30 - r)) / 30 : r > 70 ? -(0.4 + (0.6 * (r - 70)) / 30) : ((r - 50) / 20) * 0.3;
      parts.push({ v, w: 0.45 });
      bits.push(`RSI ${r.toFixed(0)}${r < 30 ? ' (oversold)' : r > 70 ? ' (overbought)' : ''}`);
    }
    if (tech.smaShort && tech.smaLong) {
      const d = tech.price / tech.smaShort - 1 + (tech.price / tech.smaLong - 1);
      parts.push({ v: tanh(d * 8), w: 0.55 });
      bits.push(`price ${tech.price >= tech.smaShort ? 'above' : 'below'} ${tech.smaShortLabel}, ${tech.price >= tech.smaLong ? 'above' : 'below'} ${tech.smaLongLabel}`);
    }
    const tw = parts.reduce((s, p) => s + p.w, 0);
    c.technical = { value: tw ? clamp(parts.reduce((s, p) => s + p.v * p.w, 0) / tw) : 0, confidence: tw ? 1 : 0, detail: bits.join(' · ') || 'Insufficient price history' };
  } else c.technical = { value: 0, confidence: 0, detail: 'Insufficient price history' };

  // --- Market mood ---
  if (fearGreed?.value != null) {
    c.marketMood = { value: clamp(((fearGreed.value - 50) / 50) * 0.8), confidence: 1, detail: `Index ${fearGreed.value} — ${fearGreed.classification}` };
  } else c.marketMood = { value: 0, confidence: 0, detail: 'Index unavailable' };

  // --- Attention ---
  c.trending = trendingRank >= 0
    ? { value: clamp(0.3 + 0.5 * (1 - trendingRank / 15), 0, 1), confidence: 1, detail: `#${trendingRank + 1} trending search on CoinGecko` }
    : { value: 0, confidence: 0.4, detail: 'Not in trending searches' };

  // --- Risk (volatility penalty) ---
  if (tech?.dailyVolatility) {
    const vol = tech.dailyVolatility;
    c.risk = { value: clamp(-tanh((vol - 0.035) / 0.03) * 0.7), confidence: 1, detail: `${(vol * 100).toFixed(1)}% daily volatility` };
  } else c.risk = { value: 0, confidence: 0, detail: 'Unknown' };

  for (const [k, v] of Object.entries(c)) {
    v.key = k; v.label = LABELS[k]; v.weight = WEIGHTS[k];
    v.value = r2(v.value); v.confidence = r2(v.confidence);
  }
  return c;
}

export function signalFor(likelihood) {
  if (likelihood >= 66) return { key: 'invest', label: 'Invest' };
  if (likelihood >= 56) return { key: 'lean-invest', label: 'Lean Invest' };
  if (likelihood >= 45) return { key: 'hold', label: 'Hold / Wait' };
  if (likelihood >= 35) return { key: 'lean-avoid', label: 'Lean Avoid' };
  return { key: 'avoid', label: 'Avoid' };
}

export function combine(components) {
  let num = 0, den = 0, wsum = 0;
  for (const [k, comp] of Object.entries(components)) {
    const w = WEIGHTS[k] ?? 0;
    wsum += w;
    num += w * comp.confidence * comp.value;
    den += w * comp.confidence;
  }
  const composite = den ? num / den : 0;
  const confidence = wsum ? den / wsum : 0;
  // Logistic map to probability, then shrink toward 50% when evidence is thin.
  const raw = 100 / (1 + Math.exp(-3.5 * composite));
  const likelihood = Math.round(50 + (raw - 50) * (0.55 + 0.45 * confidence));
  return {
    composite: +composite.toFixed(4),
    score: Math.round(50 + 50 * composite), // sentiment score 0–100
    likelihood, // % likelihood that investing is advisable now
    confidence: Math.round(confidence * 100),
    signal: signalFor(likelihood),
    components,
  };
}

const STABLES = new Set(['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDE', 'USDS', 'PYUSD', 'USDD', 'BUSD', 'FRAX', 'GUSD', 'USDP', 'LUSD', 'EURC', 'USD0', 'RLUSD', 'USD1', 'BSC-USD', 'USDTB', 'USDX', 'SUSDS', 'SUSDE']);
export function isStablecoin(coin) {
  if (STABLES.has(coin.symbol)) return true;
  return /usd/i.test(coin.symbol) && coin.price > 0.97 && coin.price < 1.03 && Math.abs(coin.change7d ?? 0) < 1.5;
}
export function isWrapped(coin) {
  return /^(wrapped|staked|bridged)\b/i.test(coin.name) || /^(W|ST|WST|CB|R|M|JITO|WE|WB)(BTC|ETH|SOL|BNB)$/i.test(coin.symbol);
}
