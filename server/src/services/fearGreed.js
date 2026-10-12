// Crypto Fear & Greed Index (alternative.me) — overall market mood, 0 (extreme fear) to 100 (extreme greed).
import { cached } from '../cache.js';
import { fetchJson } from '../http.js';

export const getFearGreedLive = () =>
  cached('fng', 30 * 60_000, async () => {
    const { data } = await fetchJson('https://api.alternative.me/fng/?limit=30');
    if (!data?.length) throw new Error('Empty Fear & Greed response');
    const history = data
      .map((d) => ({ ts: Number(d.timestamp) * 1000, value: Number(d.value), classification: d.value_classification }))
      .reverse();
    const latest = history.at(-1);
    return { value: latest.value, classification: latest.classification, history };
  });
