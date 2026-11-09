// Saved data for logged-in users.
// GET  /api/me?type=watchlist|searches
// POST /api/me {type:"watchlist", item}  or {type:"searches", item:{name, query, filters}}
// DELETE /api/me?type=watchlist&id=ASIN   (or type=searches&id=<id>)
import crypto from "node:crypto";
import { route, send, readBody, query } from "../lib/http.js";
import { httpErr } from "../lib/auth.js";
import { limits } from "../lib/plans.js";
import * as db from "../lib/db.js";

const TYPES = { watchlist: "watchlist", searches: "savedSearches", suppliers: "watchlist", projects: "savedSearches" };

export default route(async (req, res, user) => {
  if (!user) throw httpErr(401, "Log in to save products and searches");
  const q = query(req);
  const body = req.method === "POST" ? await readBody(req) : {};
  const type = (q.get("type") || "").trim() || body.type;
  if (!TYPES[type]) throw httpErr(400, "type must be watchlist, searches, suppliers or projects");
  if ((type === "suppliers" || type === "projects") && limits(user).studioPerDay === 0 && req.method !== "GET") throw httpErr(402, "Supplier CRM and projects are part of Elite and Store Manager", { upgrade: true });
  const key = `${type}:${user.email}`;
  const list = (await db.get(key)) || [];

  if (req.method === "GET") return send(res, 200, { items: list });

  if (req.method === "POST") {
    const { item } = body;
    if (!item) throw httpErr(400, "Missing item");
    const max = limits(user)[TYPES[type]];
    let entry;
    if (type === "watchlist") {
      if (!/^[A-Z0-9]{10}$/.test(item.asin || "")) throw httpErr(400, "Bad ASIN");
      entry = {
        asin: item.asin, title: String(item.title || "").slice(0, 200), image: item.image || null,
        price: item.price ?? null, score: item.score ?? null, monthlySales: item.monthlySales ?? null,
        margin: item.margin ?? null, note: String(item.note || "").slice(0, 500), added: Date.now(),
      };
      const i = list.findIndex((x) => x.asin === entry.asin);
      if (i >= 0) { list[i] = { ...list[i], ...entry, added: list[i].added }; }
      else { if (list.length >= max) throw httpErr(429, `Your plan allows ${max} watchlist products`, { upgrade: true }); list.unshift(entry); }
    } else if (type === "suppliers") {
      // Supplier CRM entry (add or update by id)
      entry = {
        id: item.id || crypto.randomBytes(6).toString("hex"), name: String(item.name || "Supplier").slice(0, 120),
        product: String(item.product || "").slice(0, 120), url: String(item.url || "").slice(0, 300), contact: String(item.contact || "").slice(0, 200),
        unitPrice: String(item.unitPrice || "").slice(0, 30), moq: String(item.moq || "").slice(0, 30), leadTime: String(item.leadTime || "").slice(0, 40),
        status: ["new", "contacted", "sample", "negotiating", "chosen", "rejected"].includes(item.status) ? item.status : "new",
        checks: Array.isArray(item.checks) ? item.checks.slice(0, 20).map(Boolean) : [], notes: String(item.notes || "").slice(0, 2000), updated: Date.now(),
      };
      const i = list.findIndex((x) => x.id === entry.id);
      if (i >= 0) list[i] = { ...list[i], ...entry }; else { if (list.length >= max) throw httpErr(429, `Your plan allows ${max} suppliers`, { upgrade: true }); list.unshift(entry); }
    } else if (type === "projects") {
      // Saved AI Store Manager outputs
      if (list.length >= max) throw httpErr(429, `Your plan allows ${max} saved projects`, { upgrade: true });
      entry = { id: crypto.randomBytes(6).toString("hex"), name: String(item.name || "Project").slice(0, 120), tool: String(item.tool || "").slice(0, 20), input: item.input || {}, result: item.result || {}, added: Date.now() };
      if (JSON.stringify(entry).length > 60000) throw httpErr(413, "Project too large to save");
      list.unshift(entry);
    } else {
      if (list.length >= max) throw httpErr(429, `Your plan allows ${max} saved searches`, { upgrade: true });
      entry = { id: crypto.randomBytes(6).toString("hex"), name: String(item.name || item.query || "Search").slice(0, 80), query: String(item.query || "").slice(0, 400), filters: item.filters || {}, added: Date.now() };
      list.unshift(entry);
    }
    await db.set(key, list);
    return send(res, 200, { items: list });
  }

  if (req.method === "DELETE") {
    const id = q.get("id");
    const next = list.filter((x) => (type === "watchlist" ? x.asin : x.id) !== id);
    await db.set(key, next);
    return send(res, 200, { items: next });
  }
  throw httpErr(405, "Method not allowed");
});
