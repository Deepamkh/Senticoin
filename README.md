# SentiCoin — AI-powered crypto sentiment & investment signals

A full-stack app (React + Node.js/Express) that gathers **market data, news, social media chatter, market mood and trending activity**, scores sentiment (optionally with **Claude AI**), and turns it into:

- a **% likelihood that investing now is advisable** for every coin, with a gauge indicator and a signal (Invest · Lean Invest · Hold/Wait · Lean Avoid · Avoid)
- a **ranked list of the top 25/50/100 cryptocurrencies** by that likelihood (sortable, searchable, filterable)
- a **coin detail page** with current price, key stats, interactive **price history chart** (24H → 1Y), factor breakdown, live news & Reddit feeds with per-item sentiment, and an AI analyst briefing
- an **expected 7-day trend** for each coin (expected path + 80% range + probability of finishing higher)

> ⚠️ **Not financial advice.** Signals are statistical estimates and can be wrong. The UI shows this disclaimer on every page.

---

## Quick start

Requires **Node.js 18+**.

```bash
cd crypto-sentiment
npm run install:all          # installs root, server and client deps

cp server/.env.example server/.env   # optional: add API keys (see below)

npm run dev                  # API on :4000 + React on :5173 → open http://localhost:5173
```

**Offline / no-API demo:** `npm run demo` runs everything on synthetic data (clearly flagged "Demo data" in the UI). The server also falls back to demo data automatically if CoinGecko is unreachable or rate-limited, so the UI never breaks.

**Production:** `npm run build && npm start` → the Express server serves the built React app at http://localhost:4000.

### Deploy to Render

This repo includes a `render.yaml` Blueprint that runs the API and the React app as **one web service**:

1. In the [Render dashboard](https://dashboard.render.com) choose **New → Blueprint** and pick this repository.
2. Fill in the secret env vars when prompted (all optional, but `COINGECKO_API_KEY` is strongly recommended because Render's shared IPs hit CoinGecko's public rate limit).
3. Click **Apply**. Build: installs server + client and runs `vite build`; start: `npm --prefix server start`. Health check: `/api/health`.

Manual setup instead of a Blueprint: create a **Web Service** with
- Build command: `npm --prefix server install && npm --prefix client install --include=dev && npm --prefix client run build`
- Start command: `npm --prefix server start`

Render's free plan sleeps after 15 minutes idle, so the first request after a pause takes ~30–60 s.

### API keys (all optional)

| Variable | What it unlocks |
|---|---|
| `ANTHROPIC_API_KEY` | **AI sentiment**: Claude scores every headline and post for the specific coin (understands context, sarcasm, relevance) and writes the analyst briefing. Without it, a crypto-tuned lexicon model is used. Model set by `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`). |
| `COINGECKO_API_KEY` | Free CoinGecko "Demo" key → higher rate limits. The app works without one. |
| `CRYPTOPANIC_API_KEY` | Extra coin-specific news with community bullish/bearish votes. |

---

## Data sources

| Signal | Source | Key? |
|---|---|---|
| Prices, market cap, volume, 7-day hourly sparkline, 1h/24h/7d/30d change, history | CoinGecko API | no |
| Community bullish-vote %, Reddit/X follower counts | CoinGecko coin detail | no |
| Trending searches (attention) | CoinGecko `/search/trending` | no |
| Global market cap, BTC dominance | CoinGecko `/global` | no |
| News & events | RSS: CoinDesk, Cointelegraph, Decrypt, Bitcoin Magazine, CryptoSlate, The Block | no |
| News + community votes | CryptoPanic | yes |
| Social chatter | Reddit: r/CryptoCurrency, r/CryptoMarkets, r/altcoin, the coin's own subreddit | no |
| Market mood | Alternative.me Crypto Fear & Greed Index | no |

Everything is cached server-side (prices 1 min, news/Reddit 10 min, deep analyses 15 min) with stale-on-error fallback, so the free tiers are respected.

---

## How the score works

Each of 7 factors produces a reading from **−1 (bearish)** to **+1 (bullish)** and a **confidence** (how much evidence backs it):

| Factor | Weight | Logic |
|---|---|---|
| News sentiment | 22% | Recency-weighted (48h half-life) sentiment of coin-matched headlines; confidence grows with article count |
| Social sentiment | 18% | Engagement-weighted Reddit post sentiment (65%) + CoinGecko community bullish votes (35%) |
| Price momentum | 20% | `tanh`-squashed blend of 24h, 7d, 30d change |
| Technical indicators | 18% | RSI-14 (oversold = positive, overbought = negative) + price vs short/long moving averages |
| Market mood | 10% | Fear & Greed Index |
| Attention / trending | 6% | Position in CoinGecko trending searches |
| Volatility risk | 6% | Penalty for high realized daily volatility |

```
composite   = Σ(weight × confidence × value) / Σ(weight × confidence)      ∈ [-1, 1]
score       = 50 + 50 × composite                                           (0–100)
likelihood  = 50 + (logistic(3.5 × composite) − 50) × (0.55 + 0.45 × confidence)
```

The likelihood shrinks toward 50% when evidence is thin, so a coin with two headlines can't get an extreme signal. Thresholds: **≥66 Invest · 56–65 Lean Invest · 45–55 Hold · 35–44 Lean Avoid · <35 Avoid**. Stablecoins are detected and shown as "Stablecoin" rather than scored.

**Quick vs deep analysis.** The ranked list does a *quick scan* (shared news/Reddit pools matched by name/ticker, hourly-sparkline technicals) so 100 coins load in one pass. Opening a coin runs a *deep analysis* — targeted Reddit search + subreddit, CryptoPanic, AI re-scoring, daily technicals over 180 days. Deep results are cached and fed back into the list (marked `deep`), so both views agree.

### 7-day expected trend

Random walk with drift on log-prices:

- drift = 35% × 30-day log-regression slope + 65% × sentiment-implied drift (`composite × σ × 0.35`), capped at ±0.5σ/day
- σ = realized daily volatility over 30 days
- 80% band = drift·t ± 1.28·σ·√t; `P(higher)` = Φ(drift·√7 / σ)

This is deliberately conservative: crypto is noisy, and the band communicates that honestly.

---

## API

| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{ ok, demoMode, aiEnabled }` |
| `GET /api/overview` | Fear & Greed (30-day history), global market stats, trending coins |
| `GET /api/coins?limit=50` | Ranked list: price, changes, sparkline, score, likelihood, signal, confidence, 7d forecast |
| `GET /api/coins/:id` | Deep analysis: coin stats, factor breakdown, technicals, forecast, last 30 days, news, Reddit posts, AI summary |
| `GET /api/coins/:id/history?days=1\|7\|30\|90\|180\|365` | `{ prices: [[ts, price]], volumes }` |

`:id` is the CoinGecko id (e.g. `bitcoin`, `solana`, `avalanche-2`).

---

## Project structure

```
crypto-sentiment/
├── package.json                 # root scripts (dev / demo / build / start)
├── server/                      # Node.js + Express API
│   ├── .env.example
│   └── src/
│       ├── index.js             # app, rate limiting, serves client/dist in prod
│       ├── config.js  cache.js  http.js
│       ├── routes/api.js
│       └── services/
│           ├── analysis.js      # orchestration: ranked list + deep analysis
│           ├── market.js        # CoinGecko
│           ├── news.js          # RSS + CryptoPanic + coin matching
│           ├── social.js        # Reddit
│           ├── fearGreed.js     # Alternative.me
│           ├── sentiment.js     # crypto lexicon + Claude scoring
│           ├── anthropic.js     # Claude Messages API client
│           ├── summary.js       # AI / rule-based analyst briefing
│           ├── technicals.js    # RSI, SMA, volatility, regression
│           ├── scoring.js       # factor model → score, likelihood, signal
│           ├── forecast.js      # 7-day drift + uncertainty model
│           └── mock.js          # deterministic demo data
└── client/                      # React 18 + Vite + Recharts
    └── src/
        ├── App.jsx  api.js  format.js  styles.css
        ├── pages/Dashboard.jsx  pages/CoinDetail.jsx
        └── components/          # LikelihoodGauge, RankedTable, PriceChart, ForecastChart,
                                 # SentimentBreakdown, FeedList, MarketOverview, Sparkline, …
```

## Extending

- **More social sources:** X/Twitter (paid API), Telegram, StockTwits, LunarCrush — add a service returning `{ title, text, score, comments, publishedAt }` and merge into `posts` in `analysis.js`.
- **On-chain data:** exchange net flows, active addresses (Glassnode, Santiment) → add a factor in `scoring.js` with its own weight.
- **Backtesting:** persist daily likelihoods (e.g. SQLite) and compare against forward 7-day returns to tune weights.
- **Alerts:** schedule `getRankedList` and notify when a coin crosses a signal threshold.
