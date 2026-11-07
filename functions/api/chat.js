// Cloudflare Pages Function: POST /api/chat
// Env vars (Cloudflare Pages > Settings > Variables and Secrets): ANTHROPIC_API_KEY (required), CLAUDE_MODEL (optional)
const SYSTEM = `You are NATASHA, a warm, sharp voice assistant. Replies are spoken aloud, so keep them short (1-3 sentences), natural, with no markdown, lists or emojis.
If the user writes or speaks Hindi, reply in Hindi (Devanagari). If they use Hinglish, reply in Hinglish. If English, reply in English. Match the user's language each turn.`;
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
function sameOrigin(request) {
  const o = request.headers.get('Origin'); if (!o) return true;
  try { return new URL(o).host === new URL(request.url).host; } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set in Cloudflare.' }, 500);
  if (Number(request.headers.get('Content-Length')) > 30000) return json({ error: 'Request too large' }, 413);
  let body; try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-12)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (messages.length && messages[0].role !== 'user') messages.shift(); // API needs the first turn to be 'user'
  if (!messages.length) return json({ error: 'Bad request' }, 400);

  const model = env.CLAUDE_MODEL || DEFAULT_MODEL;
  const payload = { model, max_tokens: 800, system: SYSTEM, messages };
  // Sonnet 5.5 has adaptive thinking on by default; 'between_tools' turns up-front thinking off (faster voice replies).
  if (model === DEFAULT_MODEL) payload.thinking = { type: 'between_tools' };

  let r, d;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    d = await r.json();
  } catch (e) { return json({ error: 'Could not reach Claude. Try again.' }, 502); }
  if (!r.ok) {
    console.error('Anthropic error', r.status, d?.error?.type, d?.error?.message);
    const msg = r.status === 401 || r.status === 403 ? 'Claude API key was rejected. Check ANTHROPIC_API_KEY.'
      : r.status === 429 ? 'Too many requests. Wait a moment.'
      : r.status === 400 ? 'Claude rejected the request. Check CLAUDE_MODEL.'
      : 'Claude is unavailable right now.';
    return json({ error: msg }, 502);
  }
  if (d.stop_reason === 'refusal') return json({ reply: "I can't help with that. मैं इसमें मदद नहीं कर सकती।" });
  const reply = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!reply) return json({ error: 'Empty reply from Claude.' }, 502);
  return json({ reply });
}
export const onRequest = () => json({ error: 'Method not allowed' }, 405);