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

export async function search({ query = "", filters = {}, costs = {}, limit = 50 }) {
  const parsed = await parseQuery(query);
  // Filters typed in the form win over ones guessed from the text.
  const f = { ...parsed.filters, ...stripEmpty(filters) };

  let raw, total, tokensLeft = null;
  if (isLive()) {
    const found = await findAsins(f);
    total = found.total;
    const got = await getProducts(found.asins.slice(0, Math.min(limit, 50)));
    raw = got.products;
    tokensLeft = got.tokensLeft ?? found.tokensLeft;
  } else {
    raw = demoSearch(f);
    total = raw.length;
  }

  let products = raw.filter((p) => p.price).map((p) => enrich(p, costs));
  if (f.minMargin != null) products = products.filter((p) => p.profit.marginPct >= f.minMargin);
  products.sort((a, b) => b.score.total - a.score.total);
  products = products.slice(0, limit);

  const ai = await explain(products, query);
  if (ai) for (const p of products) if (ai[p.asin]) p.aiNote = ai[p.asin];

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
  return e;
}

function stripEmpty(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (v !== "" && v != null) out[k] = v;
  return out;
}
