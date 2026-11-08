// Daily / monthly usage counters per user (or per IP for visitors).
import crypto from "node:crypto";
import * as db from "./db.js";
import { limits } from "./plans.js";
import { httpErr } from "./auth.js";

const day = () => new Date().toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);

export function who(req, user) {
  if (user) return user.email;
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "x").split(",")[0].trim();
  return "ip:" + crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

const KINDS = {
  search: { limit: "searchesPerDay", period: "day", label: "searches today" },
  ai: { limit: "aiPerDay", period: "day", label: "AI requests today" },
  studio: { limit: "studioPerDay", period: "day", label: "AI Store Manager runs today" },
  audit: { limit: "auditsPerMonth", period: "month", label: "listing audits this month" },
};

function key(id, kind) {
  const k = KINDS[kind];
  return `use:${id}:${kind}:${k.period === "day" ? day() : month()}`;
}

// Throws 402/429 if the user has hit their plan limit; otherwise counts one use.
export async function use(req, user, kind) {
  const lim = limits(user);
  const max = lim[KINDS[kind].limit];
  if (!max) throw httpErr(402, `${KINDS[kind].label.replace(/ (today|this month)$/, "")} are not included in the ${lim.name} plan`, { upgrade: true, plan: lim.id });
  const id = who(req, user);
  const n = await db.incr(key(id, kind), KINDS[kind].period === "day" ? 2 * 86400 : 32 * 86400);
  if (n > max) throw httpErr(429, `You've used all ${max} ${KINDS[kind].label} on the ${lim.name} plan`, { upgrade: true, plan: lim.id });
  return { used: n, max };
}

export async function summary(req, user) {
  const lim = limits(user);
  const id = who(req, user);
  const out = {};
  for (const [k, v] of Object.entries(KINDS)) out[k] = { used: await db.peek(key(id, k)), max: lim[v.limit] };
  return out;
}
