// Social chatter from two free, keyless sources:
//  - Reddit: public JSON endpoints (hot posts, targeted search, the coin's own subreddit)
//  - Mastodon: public hashtag timelines (#bitcoin, #solana, …) on one or more instances
// Every post is normalized to { id, platform, title, text, score, comments, source, link, publishedAt, sentiment }.
import { config } from '../config.js';
import { cached } from '../cache.js';
import { fetchJson } from '../http.js';
import { lexiconScore } from './sentiment.js';

const UA = { 'User-Agent': 'web:senticoin:v1.0 (crypto sentiment research)' };
const TEN_DAYS = 10 * 86400_000;
const ttl = (v) => (v.length ? 10 * 60_000 : 2 * 60_000);

const settled = (res) => res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
function uniqueRecent(posts) {
  const seen = new Set();
  return posts
    .filter((p) => (seen.has(p.id) ? false : seen.add(p.id)))
    .filter((p) => Date.now() - p.publishedAt < TEN_DAYS);
}

// ------------------------------------------------------------------ Reddit
function normReddit(p) {
  const d = p.data || p;
  const post = {
    id: `r-${d.id}`,
    platform: 'reddit',
    title: d.title || '',
    text: (d.selftext || '').replace(/\s+/g, ' ').slice(0, 280),
    score: d.ups ?? d.score ?? 0,
    comments: d.num_comments ?? 0,
    source: `r/${d.subreddit}`,
    link: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
    publishedAt: (d.created_utc || Date.now() / 1000) * 1000,
  };
  post.sentiment = lexiconScore(`${post.title}. ${post.text}`);
  return post;
}

async function redditListing(url) {
  const d = await fetchJson(url, { headers: UA, timeout: 8000 });
  return (d.data?.children || []).filter((c) => !c.data?.stickied).map(normReddit);
}

// ------------------------------------------------------------------ Mastodon
const stripHtml = (s = '') =>
  s.replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();

function normToot(raw, instance) {
  const s = raw.reblog || raw; // boosts carry the original post
  const text = stripHtml(s.content);
  if (!text) return null;
  const cut = text.length > 200 ? text.lastIndexOf(' ', 200) : -1;
  const post = {
    id: `m-${s.uri || s.id}`,
    platform: 'mastodon',
    title: cut > 80 ? `${text.slice(0, cut)}…` : text.slice(0, 220),
    text: cut > 80 ? text.slice(cut, 480) : '',
    score: (s.favourites_count || 0) + 2 * (s.reblogs_count || 0),
    comments: s.replies_count || 0,
    source: s.account?.acct ? `@${s.account.acct.includes('@') ? s.account.acct : `${s.account.acct}@${instance}`}` : instance,
    link: s.url || s.uri || null,
    publishedAt: Date.parse(s.created_at) || Date.now(),
    language: s.language,
  };
  post.sentiment = lexiconScore(text);
  return post;
}

async function mastodonTag(instance, tag, limit = 40) {
  const d = await fetchJson(`https://${instance}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${limit}`, { headers: UA, timeout: 8000 });
  return (Array.isArray(d) ? d : [])
    .map((s) => normToot(s, instance))
    .filter((p) => p && (!p.language || p.language.startsWith('en')));
}

const mastodonTags = (tags, limit) =>
  config.mastodonInstances.flatMap((inst) => tags.map((t) => mastodonTag(inst, t, limit)));

// Hashtags people actually use for a coin: #bitcoin, #btc, #shibainu …
const SKIP_TAGS = new Set(['one', 'gas', 'key', 'hot', 'safe', 'near', 'link', 'flow', 'just', 'true', 'magic', 'high', 'not', 'move', 'people', 'sun', 'cake', 'ape', 'pol', 'usd']);
export function coinHashtags(coin) {
  const name = (coin.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const sym = (coin.symbol || '').toLowerCase();
  const tags = [];
  if (name.length >= 3) tags.push(name);
  if (sym.length >= 3 && sym !== name && !SKIP_TAGS.has(sym)) tags.push(sym);
  return tags.slice(0, 2);
}

// ------------------------------------------------------------------ public API
/** Market-wide pool shared by every coin in the ranked list. */
export const getHotPostsLive = () =>
  cached('social:hot', ttl, async () => {
    const res = await Promise.allSettled([
      redditListing('https://www.reddit.com/r/CryptoCurrency/hot.json?limit=100'),
      redditListing('https://www.reddit.com/r/CryptoMarkets/hot.json?limit=50'),
      ...mastodonTags(['crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'altcoin'], 40),
    ]);
    return uniqueRecent(settled(res));
  });

/** Coin-targeted posts for the detail view (Reddit search + subreddit + Mastodon hashtags). */
export const searchCoinPostsLive = (coin) =>
  cached(`social:${coin.id}`, ttl, async () => {
    const q = encodeURIComponent(`"${coin.name}" OR ${coin.symbol}`);
    const jobs = [
      redditListing(`https://www.reddit.com/r/CryptoCurrency+CryptoMarkets+altcoin+CryptoCurrencyTrading/search.json?q=${q}&restrict_sr=1&sort=relevance&t=week&limit=40`),
      ...mastodonTags(coinHashtags(coin), 40),
    ];
    if (coin.subreddit) jobs.push(redditListing(`https://www.reddit.com/r/${encodeURIComponent(coin.subreddit)}/hot.json?limit=25`));
    const all = uniqueRecent(settled(await Promise.allSettled(jobs)));
    // Keep a balanced mix so one platform can't crowd out the other.
    const top = (platform, n) => all.filter((p) => p.platform === platform).sort((a, b) => b.score - a.score).slice(0, n);
    return [...top('reddit', 20), ...top('mastodon', 15)].sort((a, b) => b.score - a.score);
  });
