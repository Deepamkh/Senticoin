import { colorForLikelihood, SIGNAL_COLORS } from '../format.js';

export default function LikelihoodBar({ value, muted }) {
  const c = muted ? SIGNAL_COLORS.stable : colorForLikelihood(value);
  return (
    <div className="lbar" title={`${value}% likelihood investing is advisable`}>
      <div className="lbar-track">
        <div className="lbar-fill" style={{ width: `${value}%`, background: c }} />
        <div className="lbar-mid" />
      </div>
      <span className="lbar-num" style={{ color: c }}>{value}%</span>
    </div>
  );
}
