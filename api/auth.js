// POST /api/auth  {action: "signup"|"login"|"logout"|"password"|"token", ...}
// GET  /api/auth  → current user, plan, limits and usage
import { route, send, readBody } from "../lib/http.js";
import { signup, login, changePassword, sessionCookie, clearCookie, sessionToken, publicUser, httpErr } from "../lib/auth.js";
import { limits, upgradeLinks, PLANS } from "../lib/plans.js";
import { summary } from "../lib/usage.js";
import { hasDb } from "../lib/db.js";

export default route(async (req, res, user) => {
  if (req.method === "GET") {
    return send(res, 200, {
      user: publicUser(user), plan: limits(user), usage: await summary(req, user),
      plans: PLANS, links: upgradeLinks(), storage: hasDb() ? "database" : "temporary",
    });
  }
  if (req.method !== "POST") throw httpErr(405, "Use GET or POST");
  const b = await readBody(req);
  switch (b.action) {
    case "signup": {
      const u = await signup(b);
      return send(res, 200, { user: publicUser(u), plan: limits(u) }, { "Set-Cookie": sessionCookie(u) });
    }
    case "login": {
      const u = await login(b);
      return send(res, 200, { user: publicUser(u), plan: limits(u) }, { "Set-Cookie": sessionCookie(u) });
    }
    case "logout":
      return send(res, 200, { ok: true }, { "Set-Cookie": clearCookie() });
    case "password":
      if (!user) throw httpErr(401, "Log in first");
      await changePassword(user, b.oldPassword, b.newPassword);
      return send(res, 200, { ok: true });
    case "token": // for the Chrome extension
      if (!user) throw httpErr(401, "Log in first");
      return send(res, 200, { token: sessionToken(user, 30) });
    default:
      throw httpErr(400, "Unknown action");
  }
});
