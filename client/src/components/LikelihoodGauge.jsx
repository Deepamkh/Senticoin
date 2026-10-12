import { colorForLikelihood, SIGNAL_COLORS } from '../format.js';

// Semicircular gauge showing the % likelihood that investing is advisable.
const SEGMENTS = [
  [0, 35, SIGNAL_COLORS.avoid],
  [35, 45, SIGNAL_COLORS['lean-avoid']],
  [45, 56, SIGNAL_COLORS.hold],
  [56, 66, SIGNAL_COLORS['lean-invest']],
  [66, 100, SIGNAL_COLORS.invest],
];

const CX = 100, CY = 100, R = 80;
const pt = (p, r = R) => [CX - r * Math.cos(Math.PI * p), CY - r * Math.sin(Math.PI * p)];

function arc(from, to) {
  const [x1, y1] = pt(from / 100);
  const [x2, y2] = pt(to / 100);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
}

export default function LikelihoodGauge({ value = 50, label, size = 240, muted = false }) {
  const v = Math.max(0, Math.min(100, value));
  const [nx, ny] = pt(v / 100, R - 18);
  const color = muted ? SIGNAL_COLORS.stable : colorForLikelihood(v);
  return (
    <figure className="gauge-wrap" style={{ width: size, maxWidth: '100%' }}>
    <svg viewBox="0 0 200 128" width="100%" role="img" aria-label={`${label || 'Investment likelihood'} ${v}%`} className="gauge">
      {SEGMENTS.map(([a, b, c]) => (
        <path key={a} d={arc(a + 0.6, b - 0.6)} stroke={muted ? 'var(--line)' : c} strokeOpacity={muted ? 1 : 0.85} strokeWidth="14" fill="none" />
      ))}
      <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="3" strokeLinecap="round" style={{ transition: 'all .6s ease' }} />
      <circle cx={CX} cy={CY} r="6" fill="var(--text)" />
      <text x={CX} y={CY + 22} textAnchor="middle" className="gauge-value" fill={color}>{Math.round(v)}%</text>
      <text x="18" y="122" className="gauge-tick" fill="var(--muted)">Avoid</text>
      <text x="182" y="122" textAnchor="end" className="gauge-tick" fill="var(--muted)">Invest</text>
    </svg>
    {label && <figcaption className="gauge-label">{label}</figcaption>}
    </figure>
  );
}
