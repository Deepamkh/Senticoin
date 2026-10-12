import { Router } from 'express';
import { config, aiEnabled } from '../config.js';
import { httpError } from '../http.js';
import { getRankedList, getCoinAnalysis, getCoinHistory, getOverview } from '../services/analysis.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const validId = (id) => {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) throw httpError(400, 'Invalid coin id');
  return id;
};
const HISTORY_RANGES = [1, 7, 30, 90, 180, 365];

router.get('/health', (req, res) => res.json({ ok: true, demoMode: config.mock, aiEnabled: aiEnabled(), time: new Date().toISOString() }));

router.get('/overview', wrap(async (req, res) => res.json(await getOverview())));

router.get('/coins', wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || config.topN, 5), 100);
  res.json(await getRankedList(limit));
}));

router.get('/coins/:id', wrap(async (req, res) => res.json(await getCoinAnalysis(validId(req.params.id)))));

router.get('/coins/:id/history', wrap(async (req, res) => {
  const days = HISTORY_RANGES.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  res.json(await getCoinHistory(validId(req.params.id), days));
}));

export default router;
