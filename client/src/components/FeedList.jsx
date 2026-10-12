import { useState } from 'react';
import { sentimentLabel, timeAgo } from '../format.js';

const PLATFORMS = {
  reddit: { label: 'Reddit', color: '#ff6a3d' },
  mastodon: { label: 'Mastodon', color: '#8c8dff' },
};

function Chip({ s }) {
  const label = sentimentLabel(s);
  const cls = s > 0.1 ? 'pos' : s < -0.1 ? 'neg' : 'neu';
  return <span className={`sent-chip ${cls}`} title={`Sentiment ${s.toFixed(2)}`}>{label}</span>;
}

function meta(it, kind) {
  if (kind === 'news') return it.source;
  if (it.platform === 'mastodon') return `${it.source} · ★ ${it.score} · 💬 ${it.comments}`;
  return `${it.source} · ▲ ${it.score} · 💬 ${it.comments}`;
}

export default function FeedList({ title, items = [], kind = 'news', empty }) {
  const platforms = kind === 'social' ? [...new Set(items.map((i) => i.platform).filter(Boolean))] : [];
  const [filter, setFilter] = useState('all');
  const shown = filter === 'all' ? items : items.filter((i) => i.platform === filter);
  const pos = shown.filter((i) => i.sentiment > 0.1).length;
  const neg = shown.filter((i) => i.sentiment < -0.1).length;

  return (
    <div className="card feed">
      <div className="card-head">
        <h3>{title}</h3>
        {shown.length > 0 && (
          <div className="small">
            <span className="up">{pos} positive</span> · <span className="down">{neg} negative</span> · <span className="muted">{shown.length - pos - neg} neutral</span>
          </div>
        )}
      </div>
      {platforms.length > 1 && (
        <div className="seg feed-tabs">
          {['all', ...platforms].map((p) => (
            <button key={p} className={filter === p ? 'on' : ''} onClick={() => setFilter(p)}>
              {p === 'all' ? `All (${items.length})` : `${PLATFORMS[p]?.label || p} (${items.filter((i) => i.platform === p).length})`}
            </button>
          ))}
        </div>
      )}
      {!shown.length && <div className="empty small">{empty}</div>}
      <ul>
        {shown.slice(0, 15).map((it) => (
          <li key={it.id}>
            <Chip s={it.sentiment} />
            <div className="feed-body">
              {it.link ? <a href={it.link} target="_blank" rel="noreferrer noopener">{it.title}</a> : <span>{it.title}</span>}
              <div className="small muted">
                {it.platform && PLATFORMS[it.platform] && (
                  <span className="platform-tag" style={{ color: PLATFORMS[it.platform].color }}>{PLATFORMS[it.platform].label}</span>
                )}
                {meta(it, kind)} · {timeAgo(it.publishedAt)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
