export interface StreamArgs {
  messages: { role: string; content: string }[];
  provider?: string;
  lang: string;
  mode?: "live";
}

/** Reads the server's SSE stream and calls onDelta for every piece of text. */
export async function streamChat(args: StreamArgs, onDelta: (d: string) => void, signal?: AbortSignal) {
  const r = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal,
  });
  if (!r.ok || !r.body) throw new Error("stream failed");
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim();
      if (p === "[DONE]") return;
      const j = JSON.parse(p);
      if (j.error) throw new Error(j.error);
      if (j.delta) onDelta(j.delta);
    }
  }
}
