"use client";
import { readUserId } from "./session";

/** POST JSON and consume a Server-Sent Events response: `step` events stream, `result` resolves, `error` rejects. */
export async function streamPost<TStep, TResult>(url: string, body: unknown, onStep: (s: TStep) => void): Promise<TResult> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-user-id": readUserId() }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: TResult | undefined;
  let got = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = chunk.match(/^event: (.+)$/m)?.[1];
      const data = chunk.match(/^data: (.+)$/m)?.[1];
      if (!ev || !data) continue;
      const d = JSON.parse(data);
      if (ev === "step") onStep(d as TStep);
      else if (ev === "result") {
        result = d as TResult;
        got = true;
      } else if (ev === "error") throw new Error(d.message);
    }
  }
  if (!got) throw new Error("The agent stopped without a result");
  return result as TResult;
}
