// Accounts and sessions (no external libraries).
import crypto from "node:crypto";
import * as db from "./db.js";
import { better } from "./plans.js";

let warned = false;
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (!warned) { console.warn("SESSION_SECRET not set — using a temporary secret (sessions reset on restart)."); warned = true; }
  return (globalThis.__FN_SECRET ||= crypto.randomBytes(32).toString("hex"));
}

const normEmail = (e) => String(e || "").trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function hashPassword(pw, salt = crypto.randomBytes(16).toString("hex")) {
  const h = crypto.scryptSync(String(pw), salt, 64).toString("hex");
  return `${salt}:${h}`;
}
function checkPassword(pw, stored) {
  const [salt, h] = String(stored).split(":");
  if (!salt || !h) return false;
  const a = Buffer.from(crypto.scryptSync(String(pw), salt, 64).toString("hex"));
  const b = Buffer.from(h);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function getUserByEmail(email) { return db.get(`user:${normEmail(email)}`); }
export async function saveUser(u) { await db.set(`user:${u.email}`, u); }

export async function signup({ email, password, name }) {
  email = normEmail(email);
  if (!validEmail(email)) throw httpErr(400, "Enter a valid email");
  if (String(password || "").length < 8) throw httpErr(400, "Password must be at least 8 characters");
  if (await getUserByEmail(email)) throw httpErr(409, "An account with this email already exists — log in instead");
  const user = { email, name: String(name || "").slice(0, 60), pass: hashPassword(password), plan: "free", planExpires: null, createdAt: Date.now() };
  // Plan bought on Shopify before the account existed.
  const pending = await db.get(`pendingplan:${email}`);
  if (pending && (!pending.expires || pending.expires > Date.now())) {
    user.plan = pending.plan; user.planExpires = pending.expires; await db.del(`pendingplan:${email}`);
  }
  await saveUser(user);
  return user;
}

export async function login({ email, password }) {
  const user = await getUserByEmail(email);
  if (!user || !checkPassword(password, user.pass)) throw httpErr(401, "Wrong email or password");
  return user;
}

export async function changePassword(user, oldPw, newPw) {
  if (!checkPassword(oldPw, user.pass)) throw httpErr(401, "Current password is wrong");
  if (String(newPw || "").length < 8) throw httpErr(400, "New password must be at least 8 characters");
  user.pass = hashPassword(newPw); await saveUser(user);
}

// Called by the Shopify webhook when a plan is bought or renewed.
export async function grantPlan(email, plan, days) {
  email = normEmail(email);
  const expires = Date.now() + days * 864e5;
  const user = await getUserByEmail(email);
  if (user) {
    const keep = user.planExpires && user.planExpires > Date.now() ? user.plan : "free";
    user.plan = better(plan, keep) === plan ? plan : keep;
    user.planExpires = Math.max(user.planExpires || 0, expires);
    user.orders = [...(user.orders || []), { plan, at: Date.now(), days }].slice(-24);
    await saveUser(user);
  } else {
    await db.set(`pendingplan:${email}`, { plan, expires }, days * 86400);
  }
}
export async function revokePlan(email) {
  const user = await getUserByEmail(email);
  if (user) { user.plan = "free"; user.planExpires = null; await saveUser(user); }
  await db.del(`pendingplan:${normEmail(email)}`);
}

// Session cookie: base64url(email|expires).signature
const COOKIE = "fn_session";
const sign = (v) => crypto.createHmac("sha256", secret()).update(v).digest("base64url");

export function sessionCookie(user, days = 30) {
  const exp = Date.now() + days * 864e5;
  const v = Buffer.from(`${user.email}|${exp}`).toString("base64url");
  return `${COOKIE}=${v}.${sign(v)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${days * 86400}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;

export async function userFromRequest(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const tok = raw ? raw.slice(COOKIE.length + 1) : bearer;
  if (!tok || !tok.includes(".")) return null;
  const [v, sig] = tok.split(".");
  const good = sign(v);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const [email, exp] = Buffer.from(v, "base64url").toString().split("|");
  if (!exp || Number(exp) < Date.now()) return null;
  return getUserByEmail(email);
}
// Token for the Chrome extension (same format as the cookie value).
export function sessionToken(user, days = 30) {
  const v = Buffer.from(`${user.email}|${Date.now() + days * 864e5}`).toString("base64url");
  return `${v}.${sign(v)}`;
}

export function publicUser(u) {
  if (!u) return null;
  const { pass, ...rest } = u;
  return rest;
}

export function httpErr(status, message, extra = {}) { const e = new Error(message); e.status = status; Object.assign(e, extra); return e; }
