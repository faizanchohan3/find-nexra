// Tiny key-value store. Uses Upstash Redis over REST when configured
// (Vercel → Storage → "Upstash for Redis" adds KV_REST_API_URL / KV_REST_API_TOKEN).
// Falls back to in-memory storage for local testing (data resets on restart).
const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const hasDb = () => Boolean(URL_() && TOKEN());

const mem = globalThis.__FN_MEM || (globalThis.__FN_MEM = new Map());

async function redis(cmd) {
  const res = await fetch(URL_(), {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN()}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const data = await res.json();
  if (data.error) throw new Error("Database error: " + data.error);
  return data.result;
}

export async function get(key) {
  if (!hasDb()) {
    const e = mem.get(key);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) { mem.delete(key); return null; }
    return structuredClone(e.v);
  }
  const r = await redis(["GET", key]);
  return r == null ? null : JSON.parse(r);
}

export async function set(key, value, ttlSeconds) {
  if (!hasDb()) { mem.set(key, { v: structuredClone(value), exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 }); return; }
  const cmd = ["SET", key, JSON.stringify(value)];
  if (ttlSeconds) cmd.push("EX", String(ttlSeconds));
  await redis(cmd);
}

export async function del(key) {
  if (!hasDb()) { mem.delete(key); return; }
  await redis(["DEL", key]);
}

// Increment a counter that expires after ttlSeconds; returns the new value.
export async function incr(key, ttlSeconds) {
  if (!hasDb()) {
    const cur = (await get(key)) || 0;
    const e = mem.get(key);
    mem.set(key, { v: cur + 1, exp: e?.exp || (ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0) });
    return cur + 1;
  }
  const n = await redis(["INCR", key]);
  if (n === 1 && ttlSeconds) await redis(["EXPIRE", key, String(ttlSeconds)]);
  return n;
}

export async function peek(key) { return (await get(key)) || 0; }
