import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { formatPrice, formatPct, changeClass } from '../format.js';

export default function ForecastChart({ recent = [], forecast }) {
  if (!forecast) return null;
  const actual = recent.map(([ts, p]) => ({ ts, actual: p }));
  const lastTs = actual.at(-1)?.ts ?? Date.now();
  const base = forecast.basePrice;
  if (actual.length) Object.assign(actual[actual.length - 1], { expected: base, band: [base, base] });
  const future = forecast.points.map((p) => ({ ts: lastTs + p.day * 86400_000, expected: p.expected, band: [p.low, p.high], day: p.day }));
  const data = [...actual, ...future];
  const up = forecast.expectedChangePct >= 0;
  const color = forecast.trend === 'sideways' ? 'var(--hold)' : up ? 'var(--up)' : 'var(--down)';

  return (
    <div className="card chart-card">
      <div className="card-head">
        <div>
          <h3>Expected trend — next 7 days</h3>
          <div className="small muted">Last 30 days (solid) · expected path (dashed) · 80% likely range (shaded)</div>
        </div>
        <div className="fc-stats">
          <div><span className="muted small">Expected</span><b className={`mono ${changeClass(forecast.expectedChangePct)}`}>{formatPct(forecast.expectedChangePct)}</b></div>
          <div><span className="muted small">P(higher)</span><b className="mono">{forecast.probabilityUp}%</b></div>
          <div><span className="muted small">Range</span><b className="mono">±{forecast.bandPct}%</b></div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={36} />
          <YAxis domain={['auto', 'auto']} tickFormatter={formatPrice} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={84} orientation="right" />
          <Tooltip
            contentStyle={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8 }}
            labelFormatter={(t) => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            formatter={(v, name) => {
              if (name === 'band') return [`${formatPrice(v[0])} – ${formatPrice(v[1])}`, '80% range'];
              return [formatPrice(v), name === 'actual' ? 'Actual' : 'Expected'];
            }}
          />
          <ReferenceLine x={lastTs} stroke="var(--muted)" strokeDasharray="2 4" label={{ value: 'Today', fill: 'var(--muted)', fontSize: 11, position: 'insideTopLeft' }} />
          <Area dataKey="band" stroke="none" fill={color} fillOpacity={0.15} isAnimationActive={false} />
          <Line dataKey="actual" stroke="var(--text)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="expected" stroke={color} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 2.5 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="small muted method">{forecast.method}</p>
    </div>
  );
}
