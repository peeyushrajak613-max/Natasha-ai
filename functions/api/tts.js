// Cloudflare Pages Function: POST /api/tts
// Env vars: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (both required)
const err = (m, s) => new Response(JSON.stringify({ error: m }), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
function sameOrigin(request) {
  const o = request.headers.get('Origin'); if (!o) return true;
  try { return new URL(o).host === new URL(request.url).host; } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return err('Forbidden', 403);
  if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) return err('ElevenLabs is not configured.', 500);
  if (Number(request.headers.get('Content-Length')) > 5000) return err('Request too large', 413);
  let body; try { body = await request.json(); } catch { return err('Bad request', 400); }
  const text = String(body.text || '').slice(0, 900);
  if (!text.trim()) return err('Bad request', 400);
  let r;
  try {
    r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' })
    });
  } catch (e) { return err('Could not reach ElevenLabs.', 502); }
  if (!r.ok) { console.error('ElevenLabs error', r.status); return err('ElevenLabs error', 502); }
  return new Response(r.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
}
export const onRequest = () => err('Method not allowed', 405);