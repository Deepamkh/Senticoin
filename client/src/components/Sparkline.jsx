// Tiny inline price line; optional dashed forecast continuation.
export default function Sparkline({ data = [], forecast = [], width = 120, height = 36 }) {
  if (!data.length) return <span className="muted">—</span>;
  const all = [...data, ...forecast];
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const n = data.length + forecast.length;
  const x = (i) => (i / (n - 1)) * width;
  const y = (v) => height - 2 - ((v - min) / span) * (height - 4);
  const line = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const fLine = forecast.length
    ? [data.at(-1), ...forecast].map((v, i) => `${x(data.length - 1 + i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    : '';
  const up = data.at(-1) >= data[0];
  const fUp = forecast.length ? forecast.at(-1) >= data.at(-1) : up;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <polyline points={line} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.6" strokeLinejoin="round" />
      {fLine && <polyline points={fLine} fill="none" stroke={fUp ? 'var(--up)' : 'var(--down)'} strokeWidth="1.6" strokeDasharray="3 3" opacity="0.8" />}
    </svg>
  );
}
