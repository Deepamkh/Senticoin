import { SIGNAL_COLORS } from '../format.js';

export default function SignalBadge({ signal, large = false }) {
  if (!signal) return null;
  const c = SIGNAL_COLORS[signal.key] || SIGNAL_COLORS.hold;
  return (
    <span className={`badge ${large ? 'badge-lg' : ''}`} style={{ color: c, background: `${c}1f`, borderColor: `${c}55` }}>
      {signal.label}
    </span>
  );
}
