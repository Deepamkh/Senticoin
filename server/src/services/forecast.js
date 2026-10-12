// 7-day expected trend: drift blended from recent price trend and the sentiment composite,
// with an 80% uncertainty band from realized volatility (random-walk with drift).
import { linreg, logReturns, stdev } from './technicals.js';

function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function forecast(closes, composite, { stepsPerDay = 1, horizon = 7, flat = false } = {}) {
  const series = closes.filter((x) => Number.isFinite(x) && x > 0);
  const last = series.at(-1);
  if (!last || series.length < 10) return null;

  const window = series.slice(-Math.min(series.length, 30 * stepsPerDay));
  const trendDaily = linreg(window.map(Math.log)).slope * stepsPerDay;
  const sigma = Math.max(stdev(logReturns(window)) * Math.sqrt(stepsPerDay), 0.0005);
  const sentimentDrift = composite * sigma * 0.35;
  const drift = flat ? 0 : clamp(0.35 * trendDaily + 0.65 * sentimentDrift, -0.5 * sigma, 0.5 * sigma);

  const z80 = 1.2816;
  const now = Date.now();
  const points = [];
  for (let t = 1; t <= horizon; t++) {
    const spread = z80 * sigma * Math.sqrt(t);
    points.push({
      day: t,
      ts: now + t * 86400_000,
      expected: last * Math.exp(drift * t),
      low: last * Math.exp(drift * t - spread),
      high: last * Math.exp(drift * t + spread),
    });
  }
  const expectedChangePct = (Math.exp(drift * horizon) - 1) * 100;
  const probabilityUp = flat ? 0.5 : normCdf((drift * Math.sqrt(horizon)) / sigma);
  const trend = expectedChangePct > 1.5 ? 'up' : expectedChangePct < -1.5 ? 'down' : 'sideways';

  return {
    horizonDays: horizon,
    basePrice: last,
    points,
    expectedChangePct: +expectedChangePct.toFixed(2),
    probabilityUp: +(probabilityUp * 100).toFixed(1),
    trend,
    dailyVolatility: +(sigma * 100).toFixed(2),
    bandPct: +((Math.exp(z80 * sigma * Math.sqrt(horizon)) - 1) * 100).toFixed(1),
    method: 'Drift = 35% 30-day log-trend + 65% sentiment-implied drift, capped at ±0.5σ/day; 80% band from realized volatility.',
  };
}
