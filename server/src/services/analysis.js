// Orchestrates data sources → sentiment → scoring → forecast.
//  - getRankedList: quick scan of the top N coins (shared news/Reddit pools, hourly sparkline technicals)
//  - getCoinAnalysis: deep dive for one coin (targeted Google News + Reddit search, optional AI scoring, daily technicals)
// Deep results are cached and fed back into the ranked list so both views agree once a coin is analyzed.
import { config, aiEnabled } from '../config.js';
import { httpError } from '../http.js';
import * as live from './market.js';
import * as mock from './mock.js';
import { getFearGreedLive } from './fearGreed.js';
import { getAllNewsLive, getCoinNewsSearch, matchArticles, dedupe } from './news.js';
import { getHotPostsLive, searchCoinPostsLive } from './social.js';
import { scoreTexts } from './sentiment.js';
import { buildComponents, combine, isStablecoin, isWrapped } from './scoring.js';
import { forecast } from './forecast.js';
import { technicalSnapshot } from './technicals.js';
import { generateSummary } from './summary.js';

const deepCache = new Map();
const DEEP_TTL = 15 * 60_000;

async function safe(fn, fallback) {
  try { return await fn(); } catch (e) { console.warn('[warn]', e.message); return fallback; }
}

let lastSource = config.mock ? 'demo' : 'live';

async function loadMarkets(limit) {
  if (config.mock) return { coins: mock.getMarkets(limit), source: 'demo' };
  try {
    const coins = await live.getMarkets(limit);
    lastSource = 'live';
    return { coins, source: 'live' };
  } catch (e) {
    console.warn('[market] CoinGecko unavailable — serving demo data:', e.message);
    lastSource = 'demo';
    return { coins: mock.getMarkets(limit), source: 'demo' };
  }
}

const getFearGreed = (source) => (source === 'demo' ? mock.getFearGreed() : safe(getFearGreedLive, null));
const getTrending = (source) => (source === 'demo' ? mock.getTrending() : safe(live.getTrending, []));
const getNews = async (source) => (source === 'demo' ? mock.getNews() : safe(getAllNewsLive, []));
const getHotPosts = async (source) => (source === 'demo' ? mock.getPosts() : safe(getHotPostsLive, []));

function downsample(arr, n) {
  if (arr.length <= n) return arr;
  const step = (arr.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => arr[Math.round(i * step)]);
}

function flagsFor(coin) {
  return { isStablecoin: isStablecoin(coin), isWrapped: isWrapped(coin) };
}

function stableOverride(result) {
  return { ...result, likelihood: 50, score: 50, signal: { key: 'stable', label: 'Stablecoin' } };
}

// ------------------------------------------------------------------ ranked list
export async function getRankedList(limit) {
  const { coins, source } = await loadMarkets(limit);
  const [fg, trending, news, posts] = await Promise.all([getFearGreed(source), getTrending(source), getNews(source), getHotPosts(source)]);
  const trendingIds = trending.map((t) => t.id);

  const rows = coins.map((coin) => {
    const flags = flagsFor(coin);
    const deep = deepCache.get(coin.id);
    const sparkline = downsample(coin.sparkline || [], 60);
    const base = {
      id: coin.id, symbol: coin.symbol, name: coin.name, image: coin.image, price: coin.price,
      marketCap: coin.marketCap, rank: coin.rank, volume24h: coin.volume24h,
      change1h: coin.change1h, change24h: coin.change24h, change7d: coin.change7d, change30d: coin.change30d,
      sparkline, ...flags,
    };
    if (deep && Date.now() - deep.at < DEEP_TTL) {
      const d = deep.result;
      return { ...base, score: d.analysis.score, likelihood: d.analysis.likelihood, signal: d.analysis.signal, confidence: d.analysis.confidence,
        composite: d.analysis.composite, forecast: pickForecast(d.forecast), newsCount: d.news.length, socialCount: d.social.posts.length, depth: 'deep' };
    }
    const tech = technicalSnapshot(coin.sparkline || [], 24);
    const coinNews = matchArticles(coin, news);
    const coinPosts = matchArticles(coin, posts);
    const components = buildComponents({ coin, tech, news: coinNews, posts: coinPosts, fearGreed: fg, trendingRank: trendingIds.indexOf(coin.id) });
    let result = combine(components);
    if (flags.isStablecoin) result = stableOverride(result);
    const fc = forecast(coin.sparkline || [], result.composite, { stepsPerDay: 24, flat: flags.isStablecoin });
    return { ...base, score: result.score, likelihood: result.likelihood, signal: result.signal, confidence: result.confidence,
      composite: result.composite, forecast: pickForecast(fc), newsCount: coinNews.length, socialCount: coinPosts.length, depth: 'quick' };
  });

  rows.sort((a, b) => (a.isStablecoin - b.isStablecoin) || (b.likelihood - a.likelihood) || (b.score - a.score) || (a.rank - b.rank));
  rows.forEach((r, i) => (r.likelihoodRank = i + 1));

  return {
    updatedAt: new Date().toISOString(),
    source,
    aiEnabled: aiEnabled(),
    fearGreed: fg && { value: fg.value, classification: fg.classification },
    sources: { newsArticles: news.length, socialPosts: posts.length },
    coins: rows,
  };
}

function pickForecast(fc) {
  if (!fc) return null;
  return { expectedChangePct: fc.expectedChangePct, probabilityUp: fc.probabilityUp, trend: fc.trend, path: fc.points.map((p) => p.expected) };
}

// ------------------------------------------------------------------ deep analysis
export async function getCoinAnalysis(id) {
  const hit = deepCache.get(id);
  if (hit && Date.now() - hit.at < DEEP_TTL) return hit.result;

  let source = config.mock ? 'demo' : 'live';
  let coin, hist;
  if (source === 'live') {
    try {
      [coin, hist] = await Promise.all([live.getCoin(id), live.getHistory(id, 180)]);
    } catch (e) {
      if (e.status === 404) throw httpError(404, `Unknown coin "${id}"`);
      console.warn('[market] coin detail unavailable — serving demo data:', e.message);
      source = 'demo';
    }
  }
  if (source === 'demo') {
    coin = mock.getCoin(id);
    hist = mock.getHistory(id, 180);
    if (!coin) throw httpError(404, `Unknown coin "${id}" (demo mode only includes the sample coins)`);
  }

  const closes = hist.prices.map((p) => p[1]);
  if (coin.price && closes.length) closes[closes.length - 1] = coin.price;
  const tech = technicalSnapshot(closes, 1);
  const flags = flagsFor(coin);

  const [fg, trending, allNews, searched, posts] = await Promise.all([
    getFearGreed(source),
    getTrending(source),
    getNews(source),
    source === 'live' ? safe(() => getCoinNewsSearch(coin), []) : [],
    source === 'live' ? safe(() => searchCoinPostsLive(coin), []) : matchArticles(coin, mock.getPosts()),
  ]);

  const news = dedupe([...matchArticles(coin, allNews), ...searched])
    .filter((a) => Date.now() - a.publishedAt < 7 * 86400_000)
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 30);
  const socialPosts = posts.slice(0, 30);

  // Re-score everything for this coin (Claude when configured — understands context, sarcasm, relevance)
  const texts = [...news.map((a) => `${a.title}${a.summary ? '. ' + a.summary : ''}`), ...socialPosts.map((p) => `${p.title}${p.text ? '. ' + p.text : ''}`)];
  const { scores, engine } = await scoreTexts(texts, { coinName: `${coin.name} (${coin.symbol})` });
  news.forEach((a, i) => (a.sentiment = +scores[i].toFixed(3)));
  socialPosts.forEach((p, i) => (p.sentiment = +scores[news.length + i].toFixed(3)));

  const components = buildComponents({
    coin, tech, news, posts: socialPosts, votesUpPct: coin.votesUpPct, fearGreed: fg,
    trendingRank: trending.findIndex((t) => t.id === coin.id),
  });
  let result = combine(components);
  if (flags.isStablecoin) result = stableOverride(result);
  const fc = forecast(closes, result.composite, { stepsPerDay: 1, flat: flags.isStablecoin });
  const summary = await generateSummary({ coin, result, fc, tech, news, posts: socialPosts, fearGreed: fg && { value: fg.value, classification: fg.classification } });

  const out = {
    updatedAt: new Date().toISOString(),
    source,
    aiEnabled: aiEnabled(),
    sentimentEngine: engine,
    coin: { ...coin, ...flags },
    analysis: { ...result, components: Object.values(result.components) },
    technicals: {
      rsi: tech.rsi != null ? +tech.rsi.toFixed(1) : null,
      smaShort: tech.smaShort, smaLong: tech.smaLong, smaShortLabel: tech.smaShortLabel, smaLongLabel: tech.smaLongLabel,
      dailyVolatilityPct: +(tech.dailyVolatility * 100).toFixed(2),
    },
    forecast: fc,
    recent: hist.prices.slice(-31),
    news,
    social: { posts: socialPosts, votesUpPct: coin.votesUpPct, community: coin.community },
    fearGreed: fg,
    summary,
  };
  deepCache.set(id, { result: out, at: Date.now() });
  return out;
}

// ------------------------------------------------------------------ history & overview
export async function getCoinHistory(id, days) {
  if (!config.mock) {
    try {
      const h = await live.getHistory(id, days);
      return { id, days, source: 'live', ...h };
    } catch (e) {
      if (e.status === 404) throw httpError(404, `Unknown coin "${id}"`);
      console.warn('[market] history unavailable — serving demo data:', e.message);
    }
  }
  const h = mock.getHistory(id, days);
  if (!h) throw httpError(404, `Unknown coin "${id}"`);
  return { id, days, source: 'demo', ...h };
}

export async function getOverview() {
  const source = config.mock ? 'demo' : lastSource;
  const useMock = source === 'demo';
  const [fg, global, trending] = await Promise.all([
    getFearGreed(source),
    useMock ? mock.getGlobal() : safe(live.getGlobal, mock.getGlobal()),
    getTrending(source),
  ]);
  return { updatedAt: new Date().toISOString(), source, aiEnabled: aiEnabled(), fearGreed: fg, global, trending };
}
