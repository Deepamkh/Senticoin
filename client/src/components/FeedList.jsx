import { sentimentLabel, timeAgo } from '../format.js';

function Chip({ s }) {
  const label = sentimentLabel(s);
  const cls = s > 0.1 ? 'pos' : s < -0.1 ? 'neg' : 'neu';
  return <span className={`sent-chip ${cls}`} title={`Sentiment ${s.toFixed(2)}`}>{label}</span>;
}

export default function FeedList({ title, items = [], kind = 'news', empty }) {
  const pos = items.filter((i) => i.sentiment > 0.1).length;
  const neg = items.filter((i) => i.sentiment < -0.1).length;
  return (
    <div className="card feed">
      <div className="card-head">
        <h3>{title}</h3>
        {items.length > 0 && (
          <div className="small">
            <span className="up">{pos} positive</span> · <span className="down">{neg} negative</span> · <span className="muted">{items.length - pos - neg} neutral</span>
          </div>
        )}
      </div>
      {!items.length && <div className="empty small">{empty}</div>}
      <ul>
        {items.slice(0, 15).map((it) => (
          <li key={it.id}>
            <Chip s={it.sentiment} />
            <div className="feed-body">
              {it.link ? <a href={it.link} target="_blank" rel="noreferrer noopener">{it.title}</a> : <span>{it.title}</span>}
              <div className="small muted">
                {kind === 'news' ? it.source : `r/${it.subreddit} · ▲ ${it.score} · 💬 ${it.comments}`} · {timeAgo(it.publishedAt)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
