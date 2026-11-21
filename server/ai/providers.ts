export interface Provider {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  apiKeyEnv?: string; // env var holding the key; absent = no key needed (local)
  local: boolean;
}

export const PROVIDERS: Provider[] = [
  { id: "qwen-local", label: "Qwen 2.5 (local, private)", baseUrl: process.env.OLLAMA_URL || "http://localhost:11434/v1", model: process.env.QWEN_MODEL || "qwen2.5:7b", local: true },
  { id: "deepseek-local", label: "DeepSeek R1 (local)", baseUrl: "http://localhost:11434/v1", model: "deepseek-r1:7b", local: true },
  { id: "gemma-local", label: "Gemma 3 (local)", baseUrl: "http://localhost:11434/v1", model: "gemma3:4b", local: true },
  { id: "gemini", label: "Google Gemini (free tier)", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", apiKeyEnv: "GEMINI_API_KEY", local: false },
  { id: "openrouter-qwen", label: "Qwen via OpenRouter (free)", baseUrl: "https://openrouter.ai/api/v1", model: "qwen/qwen-2.5-72b-instruct:free", apiKeyEnv: "OPENROUTER_API_KEY", local: false },
  { id: "openrouter-deepseek", label: "DeepSeek via OpenRouter (free)", baseUrl: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-chat-v3-0324:free", apiKeyEnv: "OPENROUTER_API_KEY", local: false },
  { id: "groq", label: "Groq Llama (free tier)", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", apiKeyEnv: "GROQ_API_KEY", local: false },
  { id: "qwen-cloud", label: "Qwen Cloud (Alibaba)", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", apiKeyEnv: "DASHSCOPE_API_KEY", local: false },
];

export const isConfigured = (p: Provider) => p.local || !!process.env[p.apiKeyEnv!];

/** Removes <think>...</think> blocks (DeepSeek R1) from a streamed text, even when tags are split across chunks. */
class ThinkFilter {
  private carry = "";
  private inThink = false;
  push(s: string): string {
    this.carry += s;
    let out = "";
    for (;;) {
      if (this.inThink) {
        const i = this.carry.indexOf("</think>");
        if (i < 0) { this.carry = this.carry.slice(-8); return out; }
        this.carry = this.carry.slice(i + 8);
        this.inThink = false;
      } else {
        const i = this.carry.indexOf("<think>");
        if (i >= 0) { out += this.carry.slice(0, i); this.carry = this.carry.slice(i + 7); this.inThink = true; continue; }
        const lt = this.carry.lastIndexOf("<");
        if (lt >= 0 && this.carry.length - lt < 7) { out += this.carry.slice(0, lt); this.carry = this.carry.slice(lt); }
        else { out += this.carry; this.carry = ""; }
        return out;
      }
    }
  }
  flush(): string { const r = this.inThink ? "" : this.carry; this.carry = ""; return r; }
}

/** Streams the reply token by token (OpenAI-compatible SSE). */
export async function* chatStream(p: Provider, messages: { role: string; content: string }[], signal?: AbortSignal): AsyncGenerator<string> {
  const key = p.apiKeyEnv ? process.env[p.apiKeyEnv] : undefined;
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model: p.model, messages, temperature: 0.7, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`${p.id} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const filter = new ThinkFilter();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (payload === "[DONE]") { const rest = filter.flush(); if (rest) yield rest; return; }
      try {
        const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (delta) { const out = filter.push(delta); if (out) yield out; }
      } catch { /* ignore malformed line */ }
    }
  }
  const rest = filter.flush();
  if (rest) yield rest;
}

export async function chatComplete(p: Provider, messages: { role: string; content: string }[]): Promise<string> {
  const key = p.apiKeyEnv ? process.env[p.apiKeyEnv] : undefined;
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model: p.model, messages, temperature: 0.7, stream: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`${p.id} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  let text: string = data.choices?.[0]?.message?.content ?? "";
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim(); // hide DeepSeek reasoning
  return text;
}
