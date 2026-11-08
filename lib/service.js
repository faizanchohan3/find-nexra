import { parseQuery, explain } from "./ai.js";
import { findAsins, getProducts } from "./keepa.js";
import { demoSearch, demoCatalog } from "./demo.js";
import { profit, opportunityScore, reasons } from "./score.js";

export const isLive = () => Boolean(process.env.KEEPA_API_KEY);

function enrich(p, costs) {
  const pr = profit(p, costs);
  const score = opportunityScore(p, pr);
  const { history, ...rest } = p;
  return { ...rest, profit: pr, score, reasons: reasons(p, pr, score) };
}

export async function search({ query = "", filters = {}, costs = {}, limit = 50, page = 0, ai = true }) {
  const parsed = await parseQuery(query, { ai });
  // Filters typed in the form win over ones guessed from the text.
  const f = { ...parsed.filters, ...stripEmpty(filters) };

  let raw, total, tokensLeft = null;
  if (isLive()) {
    const found = await findAsins(f, page);
    total = found.total;
    const got = await getProducts(found.asins.slice(0, Math.min(limit, 50)));
    raw = got.products;
    tokensLeft = got.tokensLeft ?? found.tokensLeft;
  } else {
    const all = demoSearch(f);
    total = all.length;
    raw = all.slice(page * 50, page * 50 + 50);
  }

  let products = raw.filter((p) => p.price).map((p) => enrich(p, costs));
  // Filters computed by findNexra (not by Keepa).
  const has = (k) => f[k] != null && f[k] !== "";
  products = products.filter((p) =>
    (!has("minMargin") || p.profit.marginPct >= f.minMargin) &&
    (!has("minRoi") || p.profit.roiPct >= f.minRoi) &&
    (!has("minProfit") || p.profit.net >= f.minProfit) &&
    (!has("minRevenue") || p.revenue >= f.minRevenue) &&
    (!has("maxRevenue") || p.revenue <= f.maxRevenue) &&
    (!has("maxVolatility") || p.priceVolatility * 100 <= f.maxVolatility) &&
    (!has("minScore") || p.score.total >= f.minScore) &&
    (!f.excludeAmazon || !p.amazonSells) &&
    (!has("excludeBrand") || !String(p.brand || "").toLowerCase().includes(String(f.excludeBrand).toLowerCase())) &&
    (!has("sizeTier") || p.sizeTier === f.sizeTier)
  );
  products.sort((a, b) => b.score.total - a.score.total);
  products = products.slice(0, limit);

  const notes = ai ? await explain(products, query) : null;
  if (notes) for (const p of products) if (notes[p.asin]) p.aiNote = notes[p.asin];

  return {
    mode: isLive() ? "live" : "demo",
    parsedBy: parsed.via,
    aiError: parsed.aiError,
    filters: f,
    total,
    count: products.length,
    tokensLeft,
    products,
  };
}

export async function product(asin, costs = {}) {
  let p;
  if (isLive()) {
    const got = await getProducts([asin], { history: true });
    p = got.products[0];
  } else {
    p = demoCatalog().find((x) => x.asin === asin);
  }
  if (!p) return null;
  const e = enrich(p, costs);
  e.history = p.history || { price: [], rank: [] };
  e.seasonality = seasonality(e.history.rank);
  return e;
}

// Months where sales rank is much better than the yearly median = seasonal peaks.
export function seasonality(rank) {
  if (!rank || rank.length < 20) return null;
  const byMonth = Array.from({ length: 12 }, () => []);
  for (const [t, r] of rank) byMonth[new Date(t).getMonth()].push(r);
  const avg = byMonth.map((a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null));
  const vals = avg.filter((x) => x != null).sort((a, b) => a - b);
  if (vals.length < 6) return null;
  const median = vals[Math.floor(vals.length / 2)];
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const peaks = avg.map((a, i) => (a != null && a < median * 0.7 ? names[i] : null)).filter(Boolean);
  return { seasonal: peaks.length > 0 && peaks.length <= 4, peaks, monthly: avg.map((a) => (a ? Math.round(a) : null)) };
}

function stripEmpty(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (v !== "" && v != null) out[k] = v;
  return out;
}
