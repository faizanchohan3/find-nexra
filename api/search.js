import { search } from "../lib/service.js";
import { cors, checkAccess, send, readBody } from "../lib/http.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!checkAccess(req, res)) return;
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  try {
    const body = await readBody(req);
    const result = await search({
      query: String(body.query || "").slice(0, 400),
      filters: body.filters || {},
      costs: body.costs || {},
      limit: Math.min(Number(body.limit) || 50, 50),
    });
    send(res, 200, result);
  } catch (e) {
    send(res, e.status === 429 ? 429 : 500, { error: e.message, tokensLeft: e.tokensLeft });
  }
}
