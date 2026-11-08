// Amazon Selling Partner API (SP-API) — read-only store connection.
// Needs an SP-API app registered in Seller Central (Apps & Services → Develop Apps).
import crypto from "node:crypto";
import * as db from "./db.js";
import { complianceCheck } from "./studio.js";

const MARKET = process.env.AMAZON_MARKETPLACE_ID || "ATVPDKIKX0DER"; // Amazon.com
const ENDPOINT = process.env.AMAZON_SPAPI_ENDPOINT || "https://sellingpartnerapi-na.amazon.com";
export const configured = () => Boolean(process.env.AMAZON_LWA_CLIENT_ID && process.env.AMAZON_LWA_CLIENT_SECRET && process.env.AMAZON_APP_ID);

// Encrypt refresh tokens at rest with SESSION_SECRET.
const keyBuf = () => crypto.createHash("sha256").update(process.env.SESSION_SECRET || globalThis.__FN_SECRET || "dev").digest();
function enc(text) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", keyBuf(), iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}
function dec(s) {
  const [iv, tag, data] = s.split(".").map((x) => Buffer.from(x, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", keyBuf(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

export async function consentUrl(user, appUrl) {
  const state = crypto.randomBytes(16).toString("hex");
  await db.set(`amzstate:${state}`, { email: user.email }, 900);
  const u = new URL("https://sellercentral.amazon.com/apps/authorize/consent");
  u.searchParams.set("application_id", process.env.AMAZON_APP_ID);
  u.searchParams.set("state", state);
  u.searchParams.set("redirect_uri", `${appUrl}/api/amazon?action=callback`);
  if (process.env.AMAZON_APP_BETA !== "false") u.searchParams.set("version", "beta"); // draft apps
  return u.toString();
}

async function lwa(params) {
  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.AMAZON_LWA_CLIENT_ID, client_secret: process.env.AMAZON_LWA_CLIENT_SECRET, ...params }),
  });
  const d = await res.json();
  if (!res.ok) throw Object.assign(new Error("Amazon login failed: " + (d.error_description || d.error || res.status)), { status: 502 });
  return d;
}

export async function finishConnect({ state, code, sellerId }) {
  const st = await db.get(`amzstate:${state}`);
  if (!st) throw Object.assign(new Error("Connection link expired — try again"), { status: 400 });
  await db.del(`amzstate:${state}`);
  const tok = await lwa({ grant_type: "authorization_code", code });
  await db.set(`amazon:${st.email}`, { sellerId, refresh: enc(tok.refresh_token), connectedAt: Date.now(), marketplace: MARKET });
  return st.email;
}

export async function connection(email) {
  const c = await db.get(`amazon:${email}`);
  return c ? { sellerId: c.sellerId, connectedAt: c.connectedAt, marketplace: c.marketplace } : null;
}
export const disconnect = (email) => db.del(`amazon:${email}`);

async function accessToken(email) {
  const c = await db.get(`amazon:${email}`);
  if (!c) throw Object.assign(new Error("Connect your Amazon store first"), { status: 400 });
  const cache = await db.get(`amzat:${email}`);
  if (cache) return { token: cache, sellerId: c.sellerId };
  const t = await lwa({ grant_type: "refresh_token", refresh_token: dec(c.refresh) });
  await db.set(`amzat:${email}`, t.access_token, Math.max(60, (t.expires_in || 3600) - 120));
  return { token: t.access_token, sellerId: c.sellerId };
}

async function sp(email, path, params = {}) {
  const { token, sellerId } = await accessToken(email);
  const url = new URL(ENDPOINT + path.replace("{sellerId}", encodeURIComponent(sellerId)));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "x-amz-access-token": token, accept: "application/json" } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error("Amazon: " + (d.errors?.[0]?.message || res.status)), { status: res.status === 403 ? 403 : 502 });
  return d;
}

const attr = (a, k) => (a?.[k] || []).map((x) => x.value).filter(Boolean);

// List the seller's listings with Amazon's own issues.
export async function listings(email, pageToken) {
  const params = { marketplaceIds: MARKET, includedData: "summaries,attributes,issues", pageSize: "20" };
  if (pageToken) params.pageToken = pageToken;
  const d = await sp(email, "/listings/2021-08-01/items/{sellerId}", params);
  return {
    next: d.pagination?.nextToken || null,
    items: (d.items || []).map((it) => {
      const s = it.summaries?.[0] || {};
      return { sku: it.sku, asin: s.asin, title: s.itemName, status: (s.status || []).join(", "), image: s.mainImage?.link || null, issues: (it.issues || []).length, attributes: it.attributes, amazonIssues: it.issues || [] };
    }),
  };
}

// Score one listing: Amazon issues + content quality + policy check.
export function auditListing(it) {
  const a = it.attributes || {};
  const title = attr(a, "item_name")[0] || it.title || "";
  const bullets = attr(a, "bullet_point");
  const description = attr(a, "product_description")[0] || "";
  const searchTerms = attr(a, "generic_keyword").join(" ");
  const images = ["main_product_image_locator", ...Array.from({ length: 8 }, (_, i) => `other_product_image_locator_${i + 1}`)].filter((k) => a[k]).length;
  const checks = [];
  const add = (ok, label, fix) => checks.push({ ok, label, fix });
  add(title.length >= 80 && title.length <= 200, `Title length ${title.length} characters`, "Use 80–200 characters with your main keywords first");
  add(bullets.length >= 5, `${bullets.length} bullet points`, "Add 5 bullet points that each start with a clear benefit");
  add(description.length >= 500, `Description ${description.length} characters`, "Write a 500+ character description (or add A+ Content)");
  add(Buffer.byteLength(searchTerms) >= 150 && Buffer.byteLength(searchTerms) <= 249, `Search terms ${Buffer.byteLength(searchTerms)} bytes`, "Fill backend search terms to 200–249 bytes without repeating title words");
  add(images >= 6, `${images} images`, "Use at least 6–7 images incl. infographic, lifestyle and size photos");
  add(!(it.amazonIssues || []).some((x) => x.severity === "ERROR"), `${(it.amazonIssues || []).length} issues reported by Amazon`, "Fix the errors Amazon reports — they can suppress the listing");
  const policy = complianceCheck({ title, bullets, description, searchTerms });
  add(policy.ok, policy.ok ? "No policy wording problems" : `${policy.issues.length} policy wording problems`, "Remove claims, promotions, emojis and ALL CAPS");
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { sku: it.sku, asin: it.asin, title, score, checks, policyIssues: policy.issues, amazonIssues: (it.amazonIssues || []).map((x) => ({ severity: x.severity, message: x.message })) };
}

// Sales for the last N days vs the N days before, by day.
export async function salesDiagnosis(email, days = 30, asin) {
  const end = new Date(); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - days * 2 * 864e5);
  const params = { marketplaceIds: MARKET, interval: `${start.toISOString()}--${end.toISOString()}`, granularity: "Day", granularityTimeZone: "US/Pacific" };
  if (asin) params.asin = asin;
  const d = await sp(email, "/sales/v1/orderMetrics", params);
  const rows = (d.payload || []).map((r) => ({ day: r.interval.slice(0, 10), units: r.unitCount, orders: r.orderCount, sales: Number(r.totalSales?.amount || 0) }));
  const half = Math.floor(rows.length / 2);
  const sum = (a, k) => a.reduce((x, r) => x + r[k], 0);
  const prev = rows.slice(0, half), cur = rows.slice(half);
  const change = (k) => (sum(prev, k) ? Math.round(((sum(cur, k) - sum(prev, k)) / sum(prev, k)) * 100) : null);
  const findings = [];
  const u = change("units"), s = change("sales");
  if (u != null && u <= -20) findings.push(`Units are down ${-u}% vs the previous ${days} days — check stock, Buy Box, price changes and listing suppression.`);
  if (u != null && u >= 20) findings.push(`Units are up ${u}% — make sure you have enough stock for the next 60 days.`);
  if (u != null && s != null && s - u <= -10) findings.push("Revenue fell faster than units — your average price dropped (coupons, deals or a price war).");
  const zeroDays = cur.filter((r) => r.units === 0).length;
  if (zeroDays >= 3) findings.push(`${zeroDays} days with zero sales recently — possible stock-out or suppressed listing.`);
  if (!findings.length) findings.push("Sales are steady. Look at listing audits for easy improvements.");
  return { days, current: { units: sum(cur, "units"), orders: sum(cur, "orders"), sales: Math.round(sum(cur, "sales") * 100) / 100 }, previous: { units: sum(prev, "units"), orders: sum(prev, "orders"), sales: Math.round(sum(prev, "sales") * 100) / 100 }, change: { units: u, sales: s }, findings, daily: rows };
}
