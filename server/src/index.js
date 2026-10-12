import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, aiEnabled } from './config.js';
import apiRouter from './routes/api.js';

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(compression());
app.use(express.json());
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', apiRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app in production (`npm run build` in /client).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`\n  Crypto Sentiment API → http://localhost:${config.port}/api`);
  console.log(`  Data:      ${config.mock ? 'DEMO (synthetic, offline)' : 'live (CoinGecko, RSS news, Reddit, Fear & Greed)'}`);
  console.log(`  Sentiment: ${aiEnabled() ? `Claude AI (${config.anthropicModel}) + lexicon` : 'lexicon model (set ANTHROPIC_API_KEY for AI scoring)'}\n`);
});
