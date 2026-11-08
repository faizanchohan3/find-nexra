import { search } from "../lib/service.js";
import { route, send, readBody } from "../lib/http.js";
import { httpErr } from "../lib/auth.js";
import { limits } from "../lib/plans.js";
import { use } from "../lib/usage.js";

export default route(async (req, res, user) => {
  if (req.method !== "POST") throw httpErr(405, "Use POST");
  const body = await readBody(req);
  const lim = limits(user);
  const page = Math.max(0, Math.floor(Number(body.page) || 0));
  if (page >= lim.pages) throw httpErr(402, `The ${lim.name} plan shows the top ${lim.pages * 50} results`, { upgrade: true, plan: lim.id });
  const query = String(body.query || "").slice(0, 400);

  await use(req, user, "search");
  const wantsAi = Boolean(query && process.env.ANTHROPIC_API_KEY);
  let ai = wantsAi;
  if (wantsAi) { try { await use(req, user, "ai"); } catch { ai = false; } }

  const result = await search({ query, filters: body.filters || {}, costs: body.costs || {}, page, ai });
  result.plan = { id: lim.id, name: lim.name, pages: lim.pages };
  result.page = page;
  result.hasMore = (page + 1) * 50 < result.total && page + 1 < lim.pages;
  if (wantsAi && !ai) result.aiLimit = `AI limit reached for today on the ${lim.name} plan — used the basic parser.`;
  send(res, 200, result);
});
