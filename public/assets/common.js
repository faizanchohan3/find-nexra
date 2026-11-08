// Shared helpers for all findNexra pages.
window.FN = (() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let status = null;

  async function api(path, opts = {}) {
    const res = await fetch(path, { credentials: "include", ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || "Something went wrong"); Object.assign(e, data, { status: res.status }); throw e; }
    return data;
  }

  async function loadStatus(force) {
    if (!status || force) status = await api("/api/status");
    return status;
  }

  // Header: plan badge + account link. Expects #nav element.
  async function nav() {
    const el = document.getElementById("nav");
    if (!el) return;
    try {
      const s = await loadStatus();
      const here = location.pathname.replace(/\/$/, "") || "/";
      const link = (href, label) => `<a class="navlink${here === href ? " on" : ""}" href="${href}">${label}</a>`;
      el.innerHTML = `${link("/", "Research")}${link("/studio", "AI Store Manager")}${link("/amazon", "My Amazon store")}
        <a class="navlink acct" href="/account">${s.user ? esc(s.user.name || s.user.email.split("@")[0]) + ` · <b>${esc(s.plan.name)}</b>` : "Log in / Sign up"}</a>`;
    } catch { el.innerHTML = '<a class="navlink acct" href="/account">Account</a>'; }
  }

  function upgradeBox(err) {
    const links = err.links || status?.links || {};
    const btn = (id, name, price) => links[id] ? `<a class="btn sm" href="${links[id]}" target="_blank" rel="noopener">${name} · $${price}/mo</a>` : "";
    return `<div class="notice err" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <span style="flex:1;min-width:220px">${esc(err.message)}${status?.user ? "" : ' — <a href="/account">log in or create a free account</a>'}</span>
      ${btn("starter", "Starter", 19)}${btn("pro", "Pro", 39)}${btn("storemanager", "Store Manager", 99)}</div>`;
  }

  function errorHtml(e) { return e.upgrade || e.status === 401 ? upgradeBox(e) : `<div class="notice err">${esc(e.message)}</div>`; }

  return { api, loadStatus, nav, esc, upgradeBox, errorHtml, money: (x, d = 2) => (x == null || isNaN(x) ? "—" : "$" + Number(x).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })), n: (x) => (x == null ? "—" : Number(x).toLocaleString()) };
})();
document.addEventListener("DOMContentLoaded", () => FN.nav());
