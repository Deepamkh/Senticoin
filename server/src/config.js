import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  topN: Math.min(Math.max(Number(process.env.TOP_N || 50), 5), 100),
  mock: process.env.MOCK_DATA === 'true' || process.argv.includes('--demo'),

  coingeckoKey: process.env.COINGECKO_API_KEY || '',
  coingeckoPro: process.env.COINGECKO_PRO === 'true',

  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',

  cryptopanicKey: process.env.CRYPTOPANIC_API_KEY || '',
  cryptopanicBase: process.env.CRYPTOPANIC_BASE || 'https://cryptopanic.com/api/developer/v2',
};

export const aiEnabled = () => Boolean(config.anthropicKey);
