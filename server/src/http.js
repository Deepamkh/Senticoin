export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export async function fetchJson(url, { headers = {}, timeout = 10000, method = 'GET', body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      body,
      headers: { 'User-Agent': 'CryptoSentimentApp/1.0 (+https://github.com)', Accept: 'application/json', ...headers },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw httpError(res.status, `HTTP ${res.status} from ${new URL(url).host}: ${text.slice(0, 160)}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw httpError(504, `Timeout calling ${new URL(url).host}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
