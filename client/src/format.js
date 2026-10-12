export function formatPrice(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  const abs = Math.abs(p);
  const digits = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 10;
  return '$' + p.toLocaleString('en-US', { minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits });
}

export function formatCompact(n, prefix = '$') {
  if (n == null || !Number.isFinite(n)) return '—';
  return prefix + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

export function formatPct(x, digits = 2) {
  if (x == null || !Number.isFinite(x)) return '—';
  return `${x >= 0 ? '+' : ''}${x.toFixed(digits)}%`;
}

export function timeAgo(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const SIGNAL_COLORS = {
  invest: '#16c784',
  'lean-invest': '#7fd36b',
  hold: '#f5b942',
  'lean-avoid': '#f08a4b',
  avoid: '#ea3943',
  stable: '#8a94a6',
};

export function colorForLikelihood(p) {
  if (p >= 66) return SIGNAL_COLORS.invest;
  if (p >= 56) return SIGNAL_COLORS['lean-invest'];
  if (p >= 45) return SIGNAL_COLORS.hold;
  if (p >= 35) return SIGNAL_COLORS['lean-avoid'];
  return SIGNAL_COLORS.avoid;
}

export const changeClass = (x) => (x == null ? '' : x >= 0 ? 'up' : 'down');

export function sentimentLabel(s) {
  if (s > 0.35) return 'Bullish';
  if (s > 0.1) return 'Positive';
  if (s < -0.35) return 'Bearish';
  if (s < -0.1) return 'Negative';
  return 'Neutral';
}
