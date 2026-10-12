// Technical indicators on a price series.
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

export function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

export function logReturns(closes) {
  const r = [];
  for (let i = 1; i < closes.length; i++) if (closes[i] > 0 && closes[i - 1] > 0) r.push(Math.log(closes[i] / closes[i - 1]));
  return r;
}

export function sma(closes, n) {
  if (closes.length < n) return null;
  return mean(closes.slice(-n));
}

export function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function linreg(ys) {
  const n = ys.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += ys[i]; sxx += i * i; sxy += i * ys[i]; }
  const den = n * sxx - sx * sx || 1;
  const slope = (n * sxy - sx * sy) / den;
  return { slope, intercept: (sy - slope * sx) / n };
}

const every = (arr, k) => arr.filter((_, i) => (arr.length - 1 - i) % k === 0);

/**
 * @param {number[]} closes
 * @param {number} stepsPerDay  1 for daily series, 24 for hourly
 */
export function technicalSnapshot(closes, stepsPerDay = 1) {
  const clean = closes.filter((x) => Number.isFinite(x) && x > 0);
  const price = clean.at(-1) ?? null;
  // RSI on daily candles for daily data, 4h candles for hourly data
  const rsiSeries = stepsPerDay === 1 ? clean : every(clean, Math.max(1, Math.round(stepsPerDay / 6)));
  const shortN = stepsPerDay === 1 ? 20 : 3 * stepsPerDay;
  const longN = stepsPerDay === 1 ? 50 : Math.min(clean.length, 7 * stepsPerDay);
  const smaShort = sma(clean, shortN);
  const smaLong = sma(clean, longN);
  const dailyVol = stdev(logReturns(clean.slice(-30 * stepsPerDay))) * Math.sqrt(stepsPerDay);
  return {
    price,
    rsi: rsi(rsiSeries, 14),
    smaShort,
    smaLong,
    smaShortLabel: stepsPerDay === 1 ? '20-day MA' : '3-day MA',
    smaLongLabel: stepsPerDay === 1 ? '50-day MA' : '7-day MA',
    dailyVolatility: dailyVol,
  };
}
