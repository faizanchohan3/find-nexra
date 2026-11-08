// Shared helpers for the API routes.
import { userFromRequest } from "./auth.js";
import { upgradeLinks } from "./plans.js";

export function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type,authorization");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return true; }
  return false;
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

// Read the exact bytes sent (needed for webhook signatures). Reads the stream
// directly so Vercel's automatic JSON parsing never re-formats the body.
export async function rawBody(req) {
  if (req.__raw != null) return req.__raw;
  if (!req.readableEnded) {
    const chunks = [];
    for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
    req.__raw = Buffer.concat(chunks).toString("utf8");
    return req.__raw;
  }
  const b = req.body;
  req.__raw = typeof b === "string" ? b : Buffer.isBuffer(b) ? b.toString() : b ? JSON.stringify(b) : "";
  return req.__raw;
}

export async function readBody(req) {
  if (req.__json) return req.__json;
  try { req.__json = JSON.parse((await rawBody(req)) || "{}"); } catch { req.__json = {}; }
  return req.__json;
}

export const query = (req) => new URL(req.url, "http://x").searchParams;

// Wraps a handler: CORS, current user, JSON errors (with upgrade links for plan limits).
export function route(fn) {
  return async (req, res) => {
    if (cors(req, res)) return;
    try {
      const user = await userFromRequest(req);
      await fn(req, res, user);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      send(res, status, { error: e.message, upgrade: e.upgrade || undefined, plan: e.plan, links: e.upgrade ? upgradeLinks() : undefined, tokensLeft: e.tokensLeft });
    }
  };
}
