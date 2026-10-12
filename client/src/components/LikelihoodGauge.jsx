import { useEffect, useRef, useState } from 'react';
import { colorForLikelihood, SIGNAL_COLORS } from '../format.js';

// Animated meter for "% likelihood investing is advisable".
// Needle sweeps in with a slight overshoot, the number counts up, ticks light up as the
// needle passes, the active zone glows, and the needle keeps a subtle idle sway.

const ZONES = [
  [0, 35, 'avoid', 'Avoid'],
  [35, 45, 'lean-avoid', 'Lean avoid'],
  [45, 56, 'hold', 'Hold'],
  [56, 66, 'lean-invest', 'Lean invest'],
  [66, 100, 'invest', 'Invest'],
];

const CX = 120, CY = 112, R = 88, BAND = R + 15;
const pt = (p, r) => [CX - r * Math.cos(Math.PI * p), CY - r * Math.sin(Math.PI * p)];
function arc(p0, p1, r) {
  const [x1, y1] = pt(p0, r);
  const [x2, y2] = pt(p1, r);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// easeOutBack: overshoots a little, then settles — reads like a physical needle
const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

function useAnimatedValue(target, duration = 1600) {
  const reduce = prefersReducedMotion();
  const [val, setVal] = useState(reduce ? target : 0);
  const current = useRef(reduce ? target : 0);
  useEffect(() => {
    if (reduce) { current.current = target; setVal(target); return undefined; }
    const from = current.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const v = from + (target - from) * easeOutBack(t);
      current.current = v;
      setVal(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);
  return val;
}

export default function LikelihoodGauge({ value = 50, label, size = 280, muted = false, zoneText }) {
  const target = clamp(Math.round(value), 0, 100);
  const anim = useAnimatedValue(target);
  const [gid] = useState(() => `g${Math.random().toString(36).slice(2, 9)}`);

  const shown = clamp(anim, 0, 100);
  const zone = ZONES.find(([a, b]) => target >= a && (target < b || b === 100)) || ZONES[2];
  const color = muted ? SIGNAL_COLORS.stable : colorForLikelihood(target);
  const angle = -90 + 1.8 * clamp(anim, -3, 103);
  const text = muted ? 'Stablecoin' : zoneText || zone[3];

  const ticks = [];
  for (let u = 0; u <= 100; u += 5) {
    const major = u % 25 === 0;
    const [x1, y1] = pt(u / 100, R - 13);
    const [x2, y2] = pt(u / 100, R - 13 - (major ? 9 : 5));
    const lit = !muted && u <= shown;
    ticks.push(
      <line key={u} x1={x1} y1={y1} x2={x2} y2={y2} stroke={lit ? 'var(--text)' : 'var(--line)'} strokeOpacity={lit ? (major ? 0.75 : 0.45) : 1}
        strokeWidth={major ? 2 : 1.4} strokeLinecap="round" />
    );
  }

  return (
    <figure className="gauge-wrap" style={{ width: size, maxWidth: '100%' }}>
      <svg viewBox="0 0 240 190" width="100%" role="img" aria-label={`${label || 'Investment likelihood'}: ${target}% (${text})`} className="gauge">
        <defs>
          <linearGradient id={`${gid}-fill`} gradientUnits="userSpaceOnUse" x1={CX - R} y1="0" x2={CX + R} y2="0">
            <stop offset="0" stopColor="#d93636" />
            <stop offset="0.38" stopColor="#e0631c" />
            <stop offset="0.5" stopColor="#e3a21a" />
            <stop offset="0.64" stopColor="#7cc95a" />
            <stop offset="1" stopColor="#15964a" />
          </linearGradient>
          <filter id={`${gid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Zone band: the zone the value sits in is lit, the others recede */}
        {ZONES.map(([a, b, key, name]) => {
          const active = !muted && key === zone[2];
          return (
            <path key={key} d={arc(a / 100 + 0.006, b / 100 - 0.006, BAND)} className="gauge-zoneband"
              stroke={muted ? 'var(--line)' : SIGNAL_COLORS[key]} strokeWidth={active ? 6 : 4} strokeLinecap="round" fill="none" opacity={active ? 1 : 0.25}>
              <title>{`${name}: ${a}–${b === 100 ? 100 : b - 1}%`}</title>
            </path>
          );
        })}

        {/* Track + animated value arc */}
        <path d={arc(0, 1, R)} stroke="var(--gauge-track)" strokeWidth="16" strokeLinecap="round" fill="none" />
        {shown > 0.5 && (
          <>
            <path d={arc(0, shown / 100, R)} stroke={muted ? 'var(--line)' : `url(#${gid}-fill)`} strokeWidth="16" strokeLinecap="round" fill="none" opacity="0.35" filter={`url(#${gid}-glow)`} />
            <path d={arc(0, shown / 100, R)} stroke={muted ? 'var(--line)' : `url(#${gid}-fill)`} strokeWidth="16" strokeLinecap="round" fill="none" />
          </>
        )}

        {ticks}
        {[0, 25, 50, 75, 100].map((u) => {
          const [x, y] = pt(u / 100, R - 33);
          return <text key={u} x={x} y={y + 3} textAnchor="middle" className="gauge-scale">{u}</text>;
        })}

        {/* Needle: JS sweep on the outer group, CSS idle sway on the inner group */}
        <g transform={`rotate(${angle.toFixed(2)} ${CX} ${CY})`}>
          <g className={muted ? '' : 'gauge-needle-idle'} style={{ transformOrigin: `${CX}px ${CY}px` }}>
            <polygon points={`${CX},${CY - R + 22} ${CX + 4.2},${CY} ${CX},${CY + 13} ${CX - 4.2},${CY}`} fill="var(--text)" />
            {!muted && <circle className="gauge-tip" cx={CX} cy={CY - R} r="5" fill={color} />}
            <circle cx={CX} cy={CY - R} r="5.5" fill="var(--panel)" stroke={color} strokeWidth="3" />
          </g>
        </g>
        <circle cx={CX} cy={CY} r="10" fill="var(--panel)" stroke={color} strokeWidth="3.5" />
        <circle cx={CX} cy={CY} r="3" fill="var(--text)" />

        <text x={CX - R} y={CY + 24} textAnchor="middle" className="gauge-end">Avoid</text>
        <text x={CX + R} y={CY + 24} textAnchor="middle" className="gauge-end">Invest</text>

        {/* Readout sits below the hub so the needle never covers it */}
        <text x={CX} y={CY + 56} textAnchor="middle" className="gauge-value" fill={color}>{Math.round(shown)}%</text>
        <text x={CX} y={CY + 74} textAnchor="middle" className="gauge-zone" fill={color}>{text}</text>
      </svg>
      {label && <figcaption className="gauge-label">{label}</figcaption>}
    </figure>
  );
}
