// Text sentiment: crypto-tuned lexicon model, upgraded to Claude scoring when ANTHROPIC_API_KEY is set.
import Sentiment from 'sentiment';
import { aiEnabled } from '../config.js';
import { cached, hashString } from '../cache.js';
import { claude, extractJson } from './anthropic.js';

const analyzer = new Sentiment();

// Domain vocabulary the generic AFINN lexicon doesn't understand (or gets wrong).
const extras = {
  bullish: 3, bearish: -3, moon: 2, mooning: 3, pump: 1, pumping: 1, dump: -2, dumping: -3, dumped: -2,
  rally: 2, rallies: 2, rallied: 2, surge: 2, surges: 2, surged: 2, soar: 2, soars: 2, soared: 2,
  breakout: 2, ath: 2, adoption: 2, approval: 2, approved: 2, approves: 2, etf: 1, partnership: 2,
  upgrade: 1, upgrades: 1, inflows: 2, inflow: 2, accumulation: 2, accumulate: 2, accumulating: 2,
  rebound: 2, rebounds: 2, recover: 1, recovers: 1, recovery: 1, gains: 2, jumps: 2, jump: 1, climbs: 2,
  climb: 1, rises: 2, rise: 1, record: 1, hodl: 1, listing: 1, listed: 1, staking: 1, launch: 1, launches: 1,
  hack: -3, hacked: -4, exploit: -3, exploited: -4, scam: -4, rug: -4, rugpull: -4, lawsuit: -2, sued: -2,
  sues: -2, ban: -3, bans: -3, banned: -3, crackdown: -3, crash: -3, crashes: -3, crashed: -3,
  plunge: -3, plunges: -3, plunged: -3, liquidation: -2, liquidations: -2, liquidated: -2, selloff: -2,
  'sell-off': -2, fud: -2, outflows: -2, outflow: -2, delist: -3, delisting: -3, delisted: -3,
  bankrupt: -4, bankruptcy: -4, fraud: -4, losses: -2, slump: -2, slumps: -2, tumble: -2, tumbles: -2,
  falls: -2, fall: -1, drop: -2, drops: -2, dropped: -2, decline: -2, declines: -2, rekt: -3,
  weakness: -2, resistance: 0, support: 0, volatile: -1, uncertainty: -2, investigation: -2, probe: -2,
};

export function lexiconScore(text) {
  if (!text) return 0;
  const r = analyzer.analyze(text, { extras });
  return Math.tanh(r.score / 4); // squash to -1..1
}

async function aiScore(texts, coinName) {
  const list = texts.map((t, i) => `${i + 1}. ${t.replace(/\s+/g, ' ').slice(0, 280)}`).join('\n');
  const prompt = `You are a crypto market sentiment analyst. For each numbered item below (news headlines and social posts), rate what it implies for the near-term price of ${coinName}, from -1 (very bearish) to 1 (very bullish). Use 0 when neutral or not actually about ${coinName}. Consider sarcasm and crypto slang.

${list}

Respond with ONLY a JSON array of exactly ${texts.length} numbers, in order.`;
  const out = await claude(prompt, { maxTokens: 800 });
  const arr = extractJson(out);
  if (!Array.isArray(arr)) throw new Error('AI did not return an array');
  return arr.map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : null));
}

/**
 * Score a batch of texts. Returns { scores: number[], engine: 'ai' | 'lexicon' }.
 */
export async function scoreTexts(texts, { coinName = 'the asset' } = {}) {
  const lex = texts.map(lexiconScore);
  if (!aiEnabled() || texts.length === 0) return { scores: lex, engine: 'lexicon' };
  const slice = texts.slice(0, 60);
  try {
    const ai = await cached(`ai:${hashString(coinName + slice.join('|'))}`, 30 * 60_000, () => aiScore(slice, coinName));
    const scores = texts.map((_, i) => (ai[i] != null ? 0.8 * ai[i] + 0.2 * lex[i] : lex[i]));
    return { scores, engine: 'ai' };
  } catch (err) {
    console.warn('[ai] scoring failed, using lexicon:', err.message);
    return { scores: lex, engine: 'lexicon' };
  }
}
