// POST /api/studio {tool: "listing"|"supplier"|"quote"|"ppc"|"launch"|"compliance", input: {...}}
import { route, send, readBody } from "../lib/http.js";
import { httpErr } from "../lib/auth.js";
import { use } from "../lib/usage.js";
import { TOOLS, complianceCheck } from "../lib/studio.js";

export const config = { maxDuration: 60 };

export default route(async (req, res, user) => {
  if (req.method !== "POST") throw httpErr(405, "Use POST");
  const { tool, input = {} } = await readBody(req);
  // The rule-based compliance check is free for everyone.
  if (tool === "compliance") return send(res, 200, complianceCheck({ ...input, bullets: [].concat(input.bullets || []) }));
  if (!TOOLS[tool]) throw httpErr(400, "Unknown tool");
  if (!user) throw httpErr(401, "Log in to use the AI Store Manager", { upgrade: true });
  const u = await use(req, user, "studio");
  const result = await TOOLS[tool](input);
  send(res, 200, { tool, result, usage: u, ai: Boolean(process.env.ANTHROPIC_API_KEY) });
});
