import { route, send } from "../lib/http.js";
import { CATEGORIES } from "../lib/categories.js";
import { hasDb } from "../lib/db.js";
import { limits, upgradeLinks } from "../lib/plans.js";
import { publicUser } from "../lib/auth.js";

export default route(async (req, res, user) => {
  send(res, 200, {
    mode: process.env.KEEPA_API_KEY ? "live" : "demo",
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    storage: hasDb() ? "database" : "temporary",
    amazonApp: Boolean(process.env.AMAZON_LWA_CLIENT_ID),
    categories: Object.keys(CATEGORIES),
    user: publicUser(user),
    plan: limits(user),
    links: upgradeLinks(),
  });
});
