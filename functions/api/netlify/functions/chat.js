const SYSTEM = `You are NATASHA, a warm, sharp voice assistant.
Replies are spoken aloud, so keep them short (1-3 sentences), natural, with no markdown, lists or emojis.
If the user writes or speaks Hindi, reply in Hindi (Devanagari).
If they use Hinglish, reply in Hinglish.
If English, reply in English. Match the user's language each turn.`;

const MODEL = "claude-sonnet-5-5";

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

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY is not configured." }, 500);
  }

  if (!event.body || event.body.length > 30000) {
    return json({ error: "Invalid or oversized request." }, 413);
  }

  let body;

  try {
    body = JSON.parse(event.body);
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-12)
    .filter(m =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
    )
    .map(m => ({
      role: m.role,
      content: m.content.slice(0, 2000)
    }));

  while (messages.length && messages[0].role !== "user") {
    messages.shift();
  }

  if (!messages.length) {
    return json({ error: "No valid messages provided." }, 400);
  }

  try {
    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          system: SYSTEM,
          messages
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", response.status, data);

      return json({
        error: response.status === 401
          ? "Claude API key was rejected."
          : response.status === 429
          ? "Too many requests. Please wait."
          : "Claude is temporarily unavailable."
      }, 502);
    }

    const reply = (data.content || [])
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("")
      .trim();

    if (!reply) {
      return json({ error: "Empty response from Claude." }, 502);
    }

    return json({ reply });

  } catch (error) {
    console.error("Chat function error:", error);
    return json({ error: "Could not connect to Claude." }, 502);
  }
};