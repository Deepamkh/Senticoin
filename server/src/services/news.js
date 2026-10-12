// News: major crypto RSS feeds (free, no key) + optional CryptoPanic aggregator with community votes.
import Parser from 'rss-parser';
import { config } from '../config.js';
import { cached } from '../cache.js';
import { fetchJson } from '../http.js';
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

/** Coin-specific news from CryptoPanic (requires free API key). Community votes are kept for blending. */
export const getCryptoPanic = (symbol) =>
  !config.cryptopanicKey
    ? Promise.resolve([])
    : cached(`cpanic:${symbol}`, 10 * 60_000, async () => {
        const d = await fetchJson(
          `${config.cryptopanicBase}/posts/?auth_token=${config.cryptopanicKey}&currencies=${encodeURIComponent(symbol)}&public=true`
        );
        return (d.results || []).slice(0, 30).map((p) => ({
          id: `cp-${p.id}`,
          title: clean(p.title),
          summary: clean(p.description || '').slice(0, 300),
          link: p.original_url || p.url || (p.slug ? `https://cryptopanic.com/news/${p.id}/${p.slug}` : null),
          source: p.source?.title || 'CryptoPanic',
          publishedAt: Date.parse(p.published_at) || Date.now(),
          votes: p.votes ? { positive: p.votes.positive || 0, negative: p.votes.negative || 0 } : null,
        }));
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
