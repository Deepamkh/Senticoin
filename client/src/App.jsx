import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import CoinDetail from './pages/CoinDetail.jsx';

export default function App() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="var(--up)" /><path d="M8 20l5-6 4 3 7-8" stroke="#0b0f17" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Senti<b>Coin</b></span>
        </Link>
        <div className="topbar-right small">
          {health?.demoMode && <span className="chip chip-warn" title="Synthetic data — run without --demo for live data">Demo data</span>}
          {health && <span className={`chip ${health.aiEnabled ? 'chip-ai' : ''}`}>{health.aiEnabled ? '✨ AI sentiment on' : 'Lexicon sentiment'}</span>}
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/coin/:id" element={<CoinDetail />} />
          <Route path="*" element={<div className="page"><h1>Not found</h1><Link to="/">Back to dashboard</Link></div>} />
        </Routes>
      </main>

      <footer className="footer small muted">
        <p>
          <b>Not financial advice.</b> Signals are statistical estimates from public sentiment and price data and can be wrong. Crypto assets are highly volatile —
          only invest what you can afford to lose and do your own research.
        </p>
        <p>Data: CoinGecko · CoinDesk, Cointelegraph, Decrypt & other RSS feeds · Reddit · Alternative.me Fear &amp; Greed · CryptoPanic (optional) · Claude (optional)</p>
      </footer>
    </div>
  );
}
