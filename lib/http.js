// Shared helpers for the API routes.
export function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && (allowed.length === 0 || allowed.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-access-code");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return true; }
  return false;
}

// Optional: set ACCESS_CODE in Vercel to keep the tool private (e.g. paid members only).
export function checkAccess(req, res) {
  const code = process.env.ACCESS_CODE;
  if (!code) return true;
  const given = req.headers["x-access-code"] || new URL(req.url, "http://x").searchParams.get("code");
  if (given === code) return true;
  send(res, 401, { error: "Access code required" });
  return false;
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { return {}; }
}
