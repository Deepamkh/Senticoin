import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatPrice, formatPct } from '../format.js';

const RANGES = [
  { days: 1, label: '24H' },
  { days: 7, label: '7D' },
  { days: 30, label: '1M' },
  { days: 90, label: '3M' },
  { days: 180, label: '6M' },
  { days: 365, label: '1Y' },
];

function tickFormatter(days) {
  return (ts) => {
    const d = new Date(ts);
    if (days <= 1) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (days <= 90) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };
}

export default function PriceChart({ prices = [], days, onRangeChange, loading }) {
  const data = prices.map(([ts, price]) => ({ ts, price }));
  const first = data[0]?.price, last = data.at(-1)?.price;
  const change = first ? (last / first - 1) * 100 : null;
  const up = change == null || change >= 0;
  const color = up ? 'var(--up)' : 'var(--down)';
  const hi = data.length ? Math.max(...data.map((d) => d.price)) : null;
  const lo = data.length ? Math.min(...data.map((d) => d.price)) : null;

  return (
    <div className="card chart-card">
      <div className="card-head">
        <div>
          <h3>Price history</h3>
          <div className="small muted">
            Change over period <span className={up ? 'up' : 'down'}>{formatPct(change)}</span> · High {formatPrice(hi)} · Low {formatPrice(lo)}
          </div>
        </div>
        <div className="seg">
          {RANGES.map((r) => (
            <button key={r.days} className={r.days === days ? 'on' : ''} onClick={() => onRangeChange(r.days)}>{r.label}</button>
          ))}
        </div>
      </div>
      <div className={`chart-body ${loading ? 'loading' : ''}`}>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={tickFormatter(days)} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
            <YAxis dataKey="price" domain={['auto', 'auto']} tickFormatter={formatPrice} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={84} orientation="right" />
            <Tooltip
              contentStyle={{ background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8 }}
              labelFormatter={(ts) => new Date(ts).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: days <= 90 ? 'short' : undefined })}
              formatter={(v) => [formatPrice(v), 'Price']}
            />
            <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2} fill="url(#priceFill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
