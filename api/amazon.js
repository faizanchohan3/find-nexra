// /api/amazon?action=status|connect|callback|listings|audit|sales   (POST action=disconnect)
import { route, send, query, readBody } from "../lib/http.js";
import { httpErr } from "../lib/auth.js";
import { limits } from "../lib/plans.js";
import { use } from "../lib/usage.js";
import * as amz from "../lib/amazon.js";

const appUrl = (req) => process.env.APP_URL || `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

export default route(async (req, res, user) => {
  const q = query(req);
  const action = q.get("action") || (req.method === "POST" ? (await readBody(req)).action : "status");

  if (action === "callback") {
    // Amazon sends the seller back here after they approve.
    await amz.finishConnect({ state: q.get("state"), code: q.get("spapi_oauth_code"), sellerId: q.get("selling_partner_id") });
    res.statusCode = 302; res.setHeader("Location", "/amazon?connected=1"); return res.end();
  }
  if (!user) throw httpErr(401, "Log in to connect your Amazon store", { upgrade: true });
  const lim = limits(user);

  if (action === "status") return send(res, 200, { configured: amz.configured(), allowed: lim.amazon, connection: await amz.connection(user.email) });
  if (!lim.amazon) throw httpErr(402, "Connecting your Amazon store is part of the Store Manager plan", { upgrade: true, plan: lim.id });
  if (!amz.configured()) throw httpErr(503, "The Amazon connection is not set up yet (SP-API app keys missing in Vercel)");

  if (action === "connect") return send(res, 200, { url: await amz.consentUrl(user, appUrl(req)) });
  if (action === "disconnect") { await amz.disconnect(user.email); return send(res, 200, { ok: true }); }
  if (action === "listings") return send(res, 200, await amz.listings(user.email, q.get("next")));
  if (action === "audit") {
    await use(req, user, "audit");
    const page = await amz.listings(user.email, q.get("next"));
    const sku = q.get("sku");
    const items = sku ? page.items.filter((x) => x.sku === sku) : page.items;
    return send(res, 200, { next: page.next, audits: items.map(amz.auditListing) });
  }
  if (action === "sales") return send(res, 200, await amz.salesDiagnosis(user.email, Math.min(90, Number(q.get("days")) || 30), q.get("asin") || undefined));
  throw httpErr(400, "Unknown action");
});
