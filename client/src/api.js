async function get(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    let msg;
    try { msg = (await res.json()).error; } catch { /* ignore */ }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  overview: () => get('/overview'),
  coins: (limit = 50) => get(`/coins?limit=${limit}`),
  coin: (id) => get(`/coins/${encodeURIComponent(id)}`),
  history: (id, days) => get(`/coins/${encodeURIComponent(id)}/history?days=${days}`),
};
