import { shouldDropStreamToken } from "./sanitizeAssistant.mjs";

export async function streamSanitizedSseToClient(res, upstream) {
  if (!upstream.ok) {
    const text = await upstream.text();
    return { ok: false, status: upstream.status, text };
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  if (!upstream.body) {
    res.end();
    return { ok: true };
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const keepalive = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(keepalive);
    }
  }, 12_000);

  try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        res.write("\n");
        continue;
      }
      if (!trimmed.startsWith("data:")) {
        res.write(`${line}\n`);
        continue;
      }

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        res.write("data: [DONE]\n\n");
        continue;
      }

      try {
        const obj = JSON.parse(payload);
        const delta = obj.choices?.[0]?.delta;
        if (delta) {
          let text = delta.content;
          if (!text?.trim() && delta.reasoning) text = delta.reasoning;
          delete delta.reasoning;
          if (text && shouldDropStreamToken(text)) continue;
          if (text) delta.content = text;
          else delete delta.content;
        }
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      } catch {
        res.write(`${line}\n`);
      }
    }
  }
  } finally {
    clearInterval(keepalive);
  }

  res.end();
  return { ok: true };
}
