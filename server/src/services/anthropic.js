// Minimal Claude Messages API client (no SDK dependency).
import { config } from '../config.js';

export async function claude(prompt, { maxTokens = 1024, system } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'x-api-key': config.anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.anthropicModel,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    return (json.content || []).map((b) => b.text || '').join('').trim();
  } finally {
    clearTimeout(timer);
  }
}

export function extractJson(text) {
  const m = text.match(/[[{][\s\S]*[\]}]/);
  if (!m) throw new Error('No JSON found in model output');
  return JSON.parse(m[0]);
}
