exports.handler = async (event) => {
  const json = (data, statusCode = 200) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return json({ error: "ElevenLabs is not configured." }, 500);
  }

  if (!event.body || event.body.length > 5000) {
    return json({ error: "Invalid or oversized request." }, 413);
  }

  let body;

  try {
    body = JSON.parse(event.body);
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  const text = String(body.text || "").slice(0, 900);

  if (!text.trim()) {
    return json({ error: "Text is required." }, 400);
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2"
        })
      }
    );

    if (!response.ok) {
      console.error("ElevenLabs error:", response.status);
      return json({ error: "ElevenLabs is temporarily unavailable." }, 502);
    }

    const audio = Buffer.from(await response.arrayBuffer()).toString("base64");

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      },
      body: audio
    };

  } catch (error) {
    console.error("TTS function error:", error);
    return json({ error: "Could not connect to ElevenLabs." }, 502);
  }
};