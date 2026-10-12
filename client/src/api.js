// Resolves once the first API response (success or failure) comes back — the intro screen waits on it.
let markReady;
export const firstData = new Promise((resolve) => { markReady = resolve; });

async function get(path) {
  try {
    const res = await fetch(`/api${path}`);
    if (!res.ok) {
      let msg;
      try { msg = (await res.json()).error; } catch { /* ignore */ }
      throw new Error(msg || `Request failed (${res.status})`);
    }
    return await res.json();
  } finally {
    if (path !== '/health') markReady();
  }
}

export const api = {
  overview: () => get('/overview'),
  coins: (limit = 50) => get(`/coins?limit=${limit}`),
  coin: (id) => get(`/coins/${encodeURIComponent(id)}`),
  history: (id, days) => get(`/coins/${encodeURIComponent(id)}/history?days=${days}`),
};
