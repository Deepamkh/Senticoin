// Analyst-style narrative for a coin: Claude when available, otherwise rule-based.
import { aiEnabled } from '../config.js';
import { cached, hashString } from '../cache.js';
import { claude } from './anthropic.js';

function ruleSummary({ coin, result, fc, news }) {
  const comps = Object.values(result.components).filter((c) => c.confidence > 0.2);
  const pos = [...comps].sort((a, b) => b.value * b.weight - a.value * a.weight).filter((c) => c.value > 0.1).slice(0, 2);
  const neg = [...comps].sort((a, b) => a.value * a.weight - b.value * b.weight).filter((c) => c.value < -0.1).slice(0, 2);
  const lines = [];
  lines.push(
    `${coin.name} scores ${result.score}/100 on combined sentiment, giving a ${result.likelihood}% investment likelihood (${result.signal.label}) at ${result.confidence}% evidence confidence.`
  );
  if (pos.length) lines.push(`Supportive factors: ${pos.map((c) => `${c.label.toLowerCase()} (${c.detail})`).join('; ')}.`);
  if (neg.length) lines.push(`Headwinds: ${neg.map((c) => `${c.label.toLowerCase()} (${c.detail})`).join('; ')}.`);
  if (fc)
    lines.push(
      `The 7-day model leans ${fc.trend === 'sideways' ? 'sideways' : fc.trend === 'up' ? 'upward' : 'downward'} (${fc.expectedChangePct >= 0 ? '+' : ''}${fc.expectedChangePct}% expected, ${fc.probabilityUp}% chance of finishing higher), with an 80% range of roughly ±${fc.bandPct}%.`
    );
  if (news[0]) lines.push(`Latest headline: “${news[0].title}”.`);
  return lines.join(' ');
}

export async function generateSummary(ctx) {
  const fallback = { text: ruleSummary(ctx), engine: 'rules' };
  if (!aiEnabled()) return fallback;
  const { coin, result, fc, tech, news, posts, fearGreed } = ctx;
  const payload = {
    coin: { name: coin.name, symbol: coin.symbol, price: coin.price, change24h: coin.change24h, change7d: coin.change7d, change30d: coin.change30d, marketCapRank: coin.rank },
    scores: { sentimentScore: result.score, investLikelihood: result.likelihood, signal: result.signal.label, confidence: result.confidence },
    factors: Object.values(result.components).map(({ label, value, confidence, detail }) => ({ label, value, confidence, detail })),
    technicals: tech && { rsi: tech.rsi && +tech.rsi.toFixed(1), dailyVolatilityPct: +(tech.dailyVolatility * 100).toFixed(2) },
    forecast7d: fc && { expectedChangePct: fc.expectedChangePct, probabilityUp: fc.probabilityUp, bandPct: fc.bandPct },
    fearGreed,
    topHeadlines: news.slice(0, 8).map((n) => ({ title: n.title, source: n.source, sentiment: +n.sentiment.toFixed(2) })),
    topSocialPosts: posts.slice(0, 5).map((p) => ({ title: p.title, upvotes: p.score, sentiment: +p.sentiment.toFixed(2) })),
  };
  const prompt = `You are a careful crypto market analyst. Using ONLY the data below, write a 4–5 sentence plain-English briefing on ${coin.name} for a retail investor: what is driving sentiment (cite specific headlines or events if present), what the scores imply, the key risk, and what would change the view. Be balanced, avoid hype, never promise returns, and do not add a disclaimer (the app shows one).

DATA:
${JSON.stringify(payload)}`;
  try {
    const text = await cached(`sum:${coin.id}:${hashString(JSON.stringify(payload.scores) + payload.topHeadlines.map((h) => h.title).join())}`, 30 * 60_000, () =>
      claude(prompt, { maxTokens: 500 })
    );
    return text ? { text, engine: 'ai' } : fallback;
  } catch (err) {
    console.warn('[ai] summary failed:', err.message);
    return fallback;
  }
}
