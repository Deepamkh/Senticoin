import { useState } from 'react';

export default function CoinIcon({ src, symbol, size = 28 }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    const hue = [...(symbol || '?')].reduce((h, ch) => h + ch.charCodeAt(0) * 37, 0) % 360;
    return (
      <span className="coin-fallback" style={{ width: size, height: size, background: `hsl(${hue} 55% 40%)`, fontSize: size * 0.36 }}>
        {(symbol || '?').slice(0, 3)}
      </span>
    );
  }
  return <img src={src} alt="" width={size} height={size} className="coin-img" onError={() => setBroken(true)} />;
}
