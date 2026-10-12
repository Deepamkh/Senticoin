// Social: Reddit (public JSON endpoints, no key). Hot posts for the market-wide scan,
// targeted search + the coin's own subreddit for deep analysis.
import { cached } from '../cache.js';
import { fetchJson } from '../http.js';
import { lexiconScore } from './sentiment.js';

const UA = { 'User-Agent': 'web:crypto-sentiment-app:v1.0 (sentiment research)' };

function normPost(p) {
  const d = p.data || p;
  const post = {
    id: d.id,
    title: d.title || '',
    text: (d.selftext || '').replace(/\s+/g, ' ').slice(0, 280),
    score: d.ups ?? d.score ?? 0,
    comments: d.num_comments ?? 0,
    subreddit: d.subreddit,
    link: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
    publishedAt: (d.created_utc || Date.now() / 1000) * 1000,
  };
  post.sentiment = lexiconScore(`${post.title}. ${post.text}`);
  return post;
}

async function listing(url) {
  const d = await fetchJson(url, { headers: UA, timeout: 8000 });
  return (d.data?.children || []).filter((c) => !c.data?.stickied).map(normPost);
}

/** Market-wide hot posts (one request pair, shared by every coin in the ranked list). */
export const getHotPostsLive = () =>
  cached('reddit:hot', (v) => (v.length ? 10 * 60_000 : 2 * 60_000), async () => {
    const res = await Promise.allSettled([
      listing('https://www.reddit.com/r/CryptoCurrency/hot.json?limit=100'),
      listing('https://www.reddit.com/r/CryptoMarkets/hot.json?limit=50'),
    ]);
    return res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  });

/** Coin-targeted posts for the detail view. */
export const searchCoinPostsLive = (coin) =>
  cached(`reddit:${coin.id}`, (v) => (v.length ? 10 * 60_000 : 2 * 60_000), async () => {
    const q = encodeURIComponent(`"${coin.name}" OR ${coin.symbol}`);
    const jobs = [
      listing(`https://www.reddit.com/r/CryptoCurrency+CryptoMarkets+altcoin+CryptoCurrencyTrading/search.json?q=${q}&restrict_sr=1&sort=relevance&t=week&limit=40`),
    ];
    if (coin.subreddit) jobs.push(listing(`https://www.reddit.com/r/${encodeURIComponent(coin.subreddit)}/hot.json?limit=25`));
    const res = await Promise.allSettled(jobs);
    const seen = new Set();
    return res
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .filter((p) => (seen.has(p.id) ? false : seen.add(p.id)))
      .filter((p) => Date.now() - p.publishedAt < 10 * 86400_000)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  });
