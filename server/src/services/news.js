// News: major crypto RSS feeds + per-coin Google News RSS search. All free, no API keys.
import Parser from 'rss-parser';
import { cached } from '../cache.js';
import { lexiconScore } from './sentiment.js';

const parser = new Parser({ timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 (CryptoSentimentApp/1.0)' } });

const FEEDS = [
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/.rss/full/' },
  { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
  { name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
];

const WEEK = 7 * 86400_000;
const clean = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

export function dedupe(items) {
  const seen = new Set();
  return items.filter((a) => {
    const k = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** All recent headlines across feeds, lexicon-scored. Cached 10 min (2 min if every feed failed). */
export const getAllNewsLive = () =>
  cached('news:all', (v) => (v.length ? 10 * 60_000 : 2 * 60_000), async () => {
    const results = await Promise.allSettled(
      FEEDS.map((f) =>
        parser.parseURL(f.url).then((feed) =>
          (feed.items || []).slice(0, 50).map((it) => ({
            id: it.guid || it.link,
            title: clean(it.title),
            summary: clean(it.contentSnippet || it.content || '').slice(0, 300),
            link: it.link,
            source: f.name,
            publishedAt: Date.parse(it.isoDate || it.pubDate) || Date.now(),
          }))
        )
      )
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) console.warn(`[news] ${failed}/${FEEDS.length} RSS feeds unavailable`);
    const items = dedupe(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])))
      .filter((a) => a.title && Date.now() - a.publishedAt < WEEK)
      .sort((a, b) => b.publishedAt - a.publishedAt);
    for (const a of items) a.sentiment = lexiconScore(`${a.title}. ${a.summary}`);
    return items;
  });

/**
 * Coin-specific headlines from Google News RSS search (free, no key) — covers mainstream
 * and smaller outlets, so less-covered coins still get news. Titles arrive as "Headline - Publisher".
 */
export const getCoinNewsSearch = (coin) =>
  cached(`gnews:${coin.id}`, (v) => (v.length ? 20 * 60_000 : 5 * 60_000), async () => {
    const q = encodeURIComponent(`"${coin.name}" (crypto OR ${coin.symbol}) when:7d`);
    const feed = await parser.parseURL(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
    return (feed.items || []).slice(0, 30).map((it) => {
      const raw = clean(it.title);
      const cut = raw.lastIndexOf(' - ');
      const title = cut > 20 ? raw.slice(0, cut) : raw;
      const source = cut > 20 ? raw.slice(cut + 3) : 'Google News';
      return {
        id: it.guid || it.link,
        title,
        summary: '',
        link: it.link,
        source,
        publishedAt: Date.parse(it.isoDate || it.pubDate) || Date.now(),
      };
    });
  });

// ---- Matching headlines/posts to a coin ----
const ALIASES = {
  ethereum: ['Ether'],
  ripple: ['Ripple'],
  'avalanche-2': ['Avalanche'],
  'the-open-network': ['Toncoin'],
  'matic-network': ['Polygon'],
  'polygon-ecosystem-token': ['Polygon'],
  binancecoin: ['Binance Coin'],
  'shiba-inu': ['SHIB'],
  dogecoin: ['Doge'],
};
// Tickers that are ordinary words / too short to match safely on their own.
const AMBIGUOUS = new Set(['ONE', 'GAS', 'KEY', 'HOT', 'SAFE', 'BEST', 'JUST', 'TRUE', 'MAGIC', 'HIGH', 'NOT', 'MOVE',
  'PEOPLE', 'APE', 'SUN', 'CAKE', 'HYPE', 'OM', 'IP', 'ME', 'AI', 'S', 'POL', 'ETF', 'SEC', 'USD', 'NEAR', 'FLOW', 'LINK']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function patternsFor(coin) {
  const names = [coin.name, ...(ALIASES[coin.id] || [])].filter((n) => n && n.length >= 3);
  const pats = names.map((n) => new RegExp(`\\b${esc(n)}\\b`, 'i'));
  const sym = coin.symbol?.toUpperCase();
  if (sym && sym.length >= 3 && !AMBIGUOUS.has(sym)) pats.push(new RegExp(`(^|[^A-Za-z0-9])\\$?${esc(sym)}(?![A-Za-z0-9])`));
  // "NEAR"/"LINK" etc: allow only when written as $TICKER
  if (sym && AMBIGUOUS.has(sym)) pats.push(new RegExp(`\\$${esc(sym)}\\b`));
  return pats;
}

export function matchArticles(coin, items) {
  const pats = patternsFor(coin);
  return items.filter((a) => {
    const text = `${a.title} ${a.summary || a.text || ''}`;
    return pats.some((p) => p.test(text));
  });
}
