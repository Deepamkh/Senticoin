import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import CoinIcon from '../components/CoinIcon.jsx';
import LikelihoodGauge from '../components/LikelihoodGauge.jsx';
import PriceChart from '../components/PriceChart.jsx';
import ForecastChart from '../components/ForecastChart.jsx';
import SentimentBreakdown from '../components/SentimentBreakdown.jsx';
import FeedList from '../components/FeedList.jsx';
import { formatPrice, formatPct, formatCompact, changeClass } from '../format.js';

export default function CoinDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [history, setHistory] = useState(null);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    const load = () => api.coin(id).then((d) => alive && setData(d)).catch((e) => alive && setError(e.message));
    load();
    const t = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(t); };
  }, [id]);

  useEffect(() => {
    let alive = true;
    setHistLoading(true);
    api.history(id, days)
      .then((h) => alive && setHistory(h))
      .catch(() => alive && setHistory(null))
      .finally(() => alive && setHistLoading(false));
    return () => { alive = false; };
  }, [id, days]);

  if (error) return <div className="page"><Link to="/" className="back">← All coins</Link><div className="alert error">{error}</div></div>;
  if (!data) return <div className="page"><Link to="/" className="back">← All coins</Link><div className="card loading-card"><div className="spinner" /> Running deep sentiment analysis… (news, social, AI scoring)</div></div>;

  const { coin, analysis, forecast, technicals, summary } = data;
  const stable = coin.isStablecoin;

  return (
    <div className="page">
      <Link to="/" className="back">← All coins</Link>

      <section className="coin-hero card">
        <div className="hero-left">
          <div className="hero-title">
            <CoinIcon src={coin.image} symbol={coin.symbol} size={44} />
            <div>
              <h1>{coin.name} <span className="muted">{coin.symbol}</span></h1>
              <div className="small muted">Market cap rank #{coin.rank ?? '—'}{coin.categories?.length ? ` · ${coin.categories.slice(0, 3).join(' · ')}` : ''}</div>
            </div>
          </div>
          <div className="hero-price">
            <span className="price mono">{formatPrice(coin.price)}</span>
            <span className={`mono ${changeClass(coin.change24h)}`}>{formatPct(coin.change24h)} (24h)</span>
          </div>
          <div className="stats-grid">
            <Stat label="Market cap" value={formatCompact(coin.marketCap)} />
            <Stat label="24h volume" value={formatCompact(coin.volume24h)} />
            <Stat label="24h range" value={`${formatPrice(coin.low24h)} – ${formatPrice(coin.high24h)}`} />
            <Stat label="7d / 30d" value={<><span className={changeClass(coin.change7d)}>{formatPct(coin.change7d, 1)}</span> / <span className={changeClass(coin.change30d)}>{formatPct(coin.change30d, 1)}</span></>} />
            <Stat label="All-time high" value={<>{formatPrice(coin.ath)} <span className="muted small">{formatPct(coin.athChangePct, 0)}</span></>} />
            <Stat label="RSI (14d)" value={technicals.rsi ?? '—'} />
            <Stat label="Daily volatility" value={`${technicals.dailyVolatilityPct}%`} />
            <Stat label="Circulating supply" value={formatCompact(coin.circulatingSupply, '')} />
          </div>
        </div>
        <div className="hero-right">
          <LikelihoodGauge value={analysis.likelihood} label="Investment likelihood" muted={stable} size={300} zoneText={analysis.signal.label} />
          <div className="hero-metrics">
            <div><span className="muted small">Sentiment score</span><b>{analysis.score}/100</b></div>
            <div><span className="muted small">Confidence</span><b>{analysis.confidence}%</b></div>
            <div><span className="muted small">7d outlook</span><b className={changeClass(forecast?.expectedChangePct)}>{forecast ? formatPct(forecast.expectedChangePct, 1) : '—'}</b></div>
          </div>
        </div>
      </section>

      {stable && <div className="alert">This is a stablecoin pegged to ~$1 — it isn't scored as an investment opportunity.</div>}

      <section className="card summary">
        <div className="card-head">
          <h3>{summary.engine === 'ai' ? '✨ AI analyst briefing' : 'Analyst briefing'}</h3>
          <span className="small muted">
            Sentiment engine: {data.sentimentEngine === 'ai' ? 'Claude AI + lexicon' : 'crypto lexicon'}
            {!data.aiEnabled && ' · add ANTHROPIC_API_KEY for AI scoring'}
          </span>
        </div>
        <p>{summary.text}</p>
      </section>

      <PriceChart prices={history?.prices || data.recent} days={days} onRangeChange={setDays} loading={histLoading} />

      <div className="grid-2">
        <ForecastChart recent={data.recent} forecast={forecast} />
        <SentimentBreakdown components={analysis.components} />
      </div>

      <div className="grid-2">
        <FeedList title="News & events" items={data.news} kind="news" empty="No recent news coverage matched this coin." />
        <FeedList title="Social chatter (Reddit + Mastodon)" items={data.social.posts} kind="social" empty="No recent Reddit or Mastodon discussion found for this coin." />
      </div>

      {(coin.description || coin.community) && (
        <section className="card about">
          <h3>About {coin.name}</h3>
          {coin.description && <p className="muted">{coin.description}{coin.description.length >= 690 ? '…' : ''}</p>}
          <div className="small muted">
            {coin.votesUpPct != null && <>Community votes: <b className="up">{Math.round(coin.votesUpPct)}% bullish</b> · </>}
            {coin.community?.redditSubscribers ? <>Reddit {formatCompact(coin.community.redditSubscribers, '')} · </> : null}
            {coin.community?.twitterFollowers ? <>X/Twitter {formatCompact(coin.community.twitterFollowers, '')} · </> : null}
            {coin.homepage && <a href={coin.homepage} target="_blank" rel="noreferrer noopener">Website ↗</a>}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-mini">
      <span className="muted small">{label}</span>
      <b className="mono">{value}</b>
    </div>
  );
}
