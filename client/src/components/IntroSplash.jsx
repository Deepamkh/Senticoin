import { useEffect, useState } from 'react';
import { firstData } from '../api.js';

// First-load intro: brand mark draws itself, then the steps the engine runs tick off.
// Leaves once the first data has arrived (at least MIN_MS so it never just flashes),
// and is shown once per browser session.

const STEPS = [
  'Fetching live prices for the top coins',
  'Reading crypto news and headlines',
  'Listening to Reddit and Mastodon',
  'Scoring sentiment and 7-day trends',
];
const MIN_MS = 2400;
const MAX_MS = 9000;
const STEP_MS = 520;
const KEY = 'senticoin:intro-seen';

function seenThisSession() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}
function rememberSeen() {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* storage unavailable: show again next load */ }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default function IntroSplash() {
  const [phase, setPhase] = useState(() => (seenThisSession() ? 'done' : 'intro'));
  const [step, setStep] = useState(0);

  // Runs once on mount; the whole intro → leaving → done sequence lives in this one effect.
  useEffect(() => {
    if (phase !== 'intro') return undefined;
    let alive = true;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), STEP_MS);
    Promise.all([wait(MIN_MS), Promise.race([firstData, wait(MAX_MS)])]).then(async () => {
      if (!alive) return;
      clearInterval(timer);
      setStep(STEPS.length); // all done
      await wait(350);
      if (!alive) return;
      setPhase('leaving');
      rememberSeen();
      await wait(560);
      if (alive) setPhase('done');
    });
    return () => { alive = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;
  const progress = Math.round((Math.min(step, STEPS.length) / STEPS.length) * 100);

  return (
    <div className={`splash ${phase === 'leaving' ? 'leaving' : ''}`} role="status" aria-live="polite" aria-label="Loading SentiCoin">
      <div className="splash-inner">
        <svg className="splash-mark" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="var(--accent)" />
          <path d="M8 20l5-6 4 3 7-8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1 className="splash-name">Senti<b>Coin</b></h1>
        <p className="splash-tag">Crypto sentiment, scored and ranked.</p>
        <ul className="splash-steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? 'done' : i === step ? 'active' : ''}>
              <span className="step-dot">
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5.2l2 2 4-4.4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              {s}
            </li>
          ))}
        </ul>
        <div className="splash-bar" aria-hidden="true"><span style={{ width: `${Math.max(6, progress)}%` }} /></div>
        <p className="splash-note">Signals are estimates, not financial advice.</p>
      </div>
    </div>
  );
}
