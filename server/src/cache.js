// Tiny in-memory TTL cache with request de-duplication and stale-on-error fallback.
const store = new Map();
const inflight = new Map();

/**
 * @param {string} key
 * @param {number | ((value:any)=>number)} ttl  ms, or a function of the fetched value
 * @param {() => Promise<any>} fn
 */
export async function cached(key, ttl, fn) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await fn();
      const ms = typeof ttl === 'function' ? ttl(value) : ttl;
      store.set(key, { value, expires: Date.now() + ms });
      return value;
    } catch (err) {
      if (hit) return hit.value; // serve stale data rather than failing
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
