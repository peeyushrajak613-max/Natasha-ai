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
    return json({ error: "Anthropic API key is missing." }, 500);
  }

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-12)
    .filter(m =>
      m &&
      ["user", "assistant"].includes(m.role) &&
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
    return json({ error: "No valid messages." }, 400);
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
          model: "claude-sonnet-5",
          max_tokens: 1000,
          system: "You are NATASHA, a calm and intelligent female voice assistant. Reply naturally and briefly. Match the user's language. Use Hindi for Hindi, Hinglish for Hinglish, and English for English.",
          messages
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", response.status, data);
      return json({ error: "Claude is temporarily unavailable." }, 502);
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
    console.error("Chat error:", error);
    return json({ error: "Could not connect to Claude." }, 502);
  }
};
      
  