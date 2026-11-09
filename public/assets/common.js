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

  // Header: main links, account pill and upgrade button. Expects #nav element.
  const ICONS = {
    search: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3"/>',
    spark: '<path d="M12 3l1.8 4.9L19 9.7l-4.9 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

  function menu() {
    const top = document.getElementById("top"), btn = document.getElementById("menuBtn");
    if (!top || !btn || btn.dataset.ready) return;
    btn.dataset.ready = "1";
    const set = (open) => { top.classList.toggle("open", open); btn.setAttribute("aria-expanded", open); btn.setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
    btn.addEventListener("click", () => set(!top.classList.contains("open")));
    document.addEventListener("keydown", (e) => e.key === "Escape" && set(false));
    matchMedia("(min-width:901px)").addEventListener("change", (m) => m.matches && set(false));
  }

  async function nav() {
    const el = document.getElementById("nav");
    if (!el) return;
    menu();
    const here = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
    const link = (href, label, ic) => `<a class="navlink${here === href ? " on" : ""}" href="${href}"${here === href ? ' aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`;
    const links = `<div class="navlinks">${link("/", "Research", "search")}${link("/studio", "AI Store Manager", "spark")}${link("/amazon", "My Amazon store", "store")}</div>`;
    const on = here === "/account" ? " on" : "";
    try {
      const s = await loadStatus();
      let right;
      if (s.user) {
        const name = s.user.name || s.user.email.split("@")[0];
        const top = s.plan.id === "storemanager";
        right = `${top ? "" : `<a class="upg" href="${esc(s.links?.[s.plan.id === "free" ? "starter" : s.plan.id === "starter" ? "pro" : "storemanager"] || "/account")}" target="_blank" rel="noopener">${icon("bolt")}Upgrade</a>`}
          <a class="acct${on}" href="/account" title="Your account"><span class="avatar">${esc(name.trim().charAt(0).toUpperCase() || "?")}</span><span class="who">${esc(name)}<small>${esc(s.plan.name)} plan</small></span></a>`;
      } else {
        right = `<a class="acct signin${on}" href="/account">Log in</a><a class="upg" href="/account">Start free</a>`;
      }
      el.innerHTML = links + right;
    } catch { el.innerHTML = links + `<a class="acct signin${on}" href="/account">Account</a>`; }
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
