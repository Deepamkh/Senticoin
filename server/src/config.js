import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  topN: Math.min(Math.max(Number(process.env.TOP_N || 50), 5), 100),
  mock: process.env.MOCK_DATA === 'true' || process.argv.includes('--demo'),

  coingeckoKey: process.env.COINGECKO_API_KEY || '',
  coingeckoPro: process.env.COINGECKO_PRO === 'true',

  // Mastodon instances whose public hashtag timelines are read (comma-separated hostnames).
  mastodonInstances: (process.env.MASTODON_INSTANCES || 'mastodon.social')
    .split(',').map((s) => s.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')).filter(Boolean),

  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',

};

export const aiEnabled = () => Boolean(config.anthropicKey);
