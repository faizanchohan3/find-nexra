// Plan limits. Prices match the plans sold on nexrallc.com.
export const PLANS = {
  free: {
    name: "Free", price: 0,
    searchesPerDay: 5, aiPerDay: 3, pages: 1, watchlist: 10, savedSearches: 2,
    compare: 0, budgetPlanner: false, studioPerDay: 0, amazon: false, auditsPerMonth: 0,
  },
  starter: {
    name: "Starter", price: 19,
    searchesPerDay: 100, aiPerDay: 20, pages: 2, watchlist: 200, savedSearches: 25,
    compare: 3, budgetPlanner: true, studioPerDay: 0, amazon: false, auditsPerMonth: 0,
  },
  pro: {
    name: "Pro", price: 39,
    searchesPerDay: 500, aiPerDay: 100, pages: 10, watchlist: 1000, savedSearches: 100,
    compare: 10, budgetPlanner: true, studioPerDay: 5, amazon: false, auditsPerMonth: 0,
  },
  storemanager: {
    name: "Store Manager", price: 99,
    searchesPerDay: 1000, aiPerDay: 200, pages: 10, watchlist: 1000, savedSearches: 100,
    compare: 10, budgetPlanner: true, studioPerDay: 30, amazon: true, auditsPerMonth: 100,
  },
};

// SKUs (or product titles) of the Shopify subscription products.
export const SKU_TO_PLAN = {
  "FINDNEXRA-STARTER": "starter",
  "FINDNEXRA-PRO": "pro",
  "FINDNEXRA-STOREMANAGER": "storemanager",
};

export function planFromLineItem(li) {
  const sku = String(li.sku || "").toUpperCase();
  if (SKU_TO_PLAN[sku]) return SKU_TO_PLAN[sku];
  const t = `${li.title || ""} ${li.name || ""}`.toLowerCase();
  if (!t.includes("findnexra")) return null;
  if (t.includes("store manager")) return "storemanager";
  if (t.includes("pro")) return "pro";
  if (t.includes("starter")) return "starter";
  return null;
}

const RANK = { free: 0, starter: 1, pro: 2, storemanager: 3 };
export const better = (a, b) => (RANK[a] >= RANK[b] ? a : b);

export function activePlan(user) {
  if (!user) return "free";
  const admins = (process.env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim());
  if (admins.includes(user.email)) return "storemanager";
  if (user.plan && user.plan !== "free" && (!user.planExpires || user.planExpires > Date.now())) return user.plan;
  return "free";
}

export function limits(user) { const id = activePlan(user); return { id, ...PLANS[id] }; }

// Where the "Upgrade" buttons send people (set to your Shopify product URLs).
export function upgradeLinks() {
  const base = process.env.SHOP_URL || "https://www.nexrallc.com";
  return {
    starter: process.env.UPGRADE_URL_STARTER || `${base}/products/findnexra-starter`,
    pro: process.env.UPGRADE_URL_PRO || `${base}/products/findnexra-pro`,
    storemanager: process.env.UPGRADE_URL_STOREMANAGER || `${base}/products/findnexra-store-manager`,
  };
}
