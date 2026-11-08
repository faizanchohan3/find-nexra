// Shopify → findNexra: unlock a plan when a findNexra subscription order is paid.
// In Shopify admin: Settings → Notifications → Webhooks → Create webhook
//   Event "Order payment" (orders/paid) and "Order cancellation" (orders/cancelled), format JSON,
//   URL https://YOUR-APP/api/shopify-webhook . Copy the signing key shown there into SHOPIFY_WEBHOOK_SECRET.
import crypto from "node:crypto";
import { send, rawBody } from "../lib/http.js";
import { planFromLineItem } from "../lib/plans.js";
import { grantPlan, revokePlan } from "../lib/auth.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  const body = await rawBody(req);
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const given = req.headers["x-shopify-hmac-sha256"] || "";
  if (!secret) return send(res, 500, { error: "SHOPIFY_WEBHOOK_SECRET not set" });
  const expected = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
  if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return send(res, 401, { error: "Bad signature" });
  }
  const topic = req.headers["x-shopify-topic"] || "";
  const order = JSON.parse(body || "{}");
  const email = order.email || order.contact_email || order.customer?.email;
  if (!email) return send(res, 200, { ignored: "no email" });

  const plans = (order.line_items || []).map((li) => ({ plan: planFromLineItem(li), li })).filter((x) => x.plan);
  if (!plans.length) return send(res, 200, { ignored: "no findNexra plan in order" });

  if (topic === "orders/cancelled" || order.cancelled_at) {
    await revokePlan(email);
    return send(res, 200, { revoked: email });
  }
  for (const { plan, li } of plans) {
    const yearly = /year|annual/i.test(`${li.selling_plan_allocation?.selling_plan?.name || ""} ${li.variant_title || ""} ${li.title || ""}`);
    await grantPlan(email, plan, yearly ? 372 : 33);
  }
  send(res, 200, { granted: plans.map((p) => p.plan), email });
}
