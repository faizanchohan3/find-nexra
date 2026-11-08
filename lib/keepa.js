// Keepa API client (Amazon.com = domain 1). Docs: https://keepa.com/#!discuss/t/product-finder/5473
import { CATEGORIES } from "./categories.js";
import { estimateMonthlySales } from "./score.js";

const BASE = "https://api.keepa.com";
const DOMAIN = 1;

// Keepa time = minutes since 2011-01-01.
const keepaTimeToMs = (t) => (t + 21564000) * 60000;

async function call(path, params) {
  const key = process.env.KEEPA_API_KEY;
  const qs = new URLSearchParams({ key, domain: String(DOMAIN), ...params });
  const res = await fetch(`${BASE}/${path}?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const msg = data.error?.message || data.error?.type || `Keepa error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.tokensLeft = data.tokensLeft;
    throw err;
  }
  return data;
}

// Turn our filters into a Keepa Product Finder selection.
export function toSelection(f) {
  const s = { productType: [0], perPage: 50, page: 0, sort: [["current_SALES", "asc"]] };
  const cents = (d) => Math.round(Number(d) * 100);
  if (f.minPrice != null) s.current_NEW_gte = cents(f.minPrice);
  if (f.maxPrice != null) s.current_NEW_lte = cents(f.maxPrice);
  if (f.minReviews != null) s.current_COUNT_REVIEWS_gte = Number(f.minReviews);
  if (f.maxReviews != null) s.current_COUNT_REVIEWS_lte = Number(f.maxReviews);
  if (f.minRating != null) s.current_RATING_gte = Math.round(Number(f.minRating) * 10);
  if (f.maxRank != null) s.current_SALES_lte = Number(f.maxRank);
  else s.current_SALES_lte = 100000; // keep results to products that actually sell
  s.current_SALES_gte = 1;
  if (f.maxSellers != null) s.current_COUNT_NEW_lte = Number(f.maxSellers);
  if (f.minMonthlySales != null) s.monthlySold_gte = Number(f.minMonthlySales);
  if (f.category && CATEGORIES[f.category]) s.rootCategory = [CATEGORIES[f.category]];
  if (f.keyword) s.title = String(f.keyword).slice(0, 60);
  return s;
}

export async function findAsins(filters) {
  const data = await call("query", { selection: JSON.stringify(toSelection(filters)) });
  return { asins: data.asinList || [], total: data.totalResults || 0, tokensLeft: data.tokensLeft };
}

export async function getProducts(asins, { history = false } = {}) {
  if (!asins.length) return { products: [], tokensLeft: null };
  const data = await call("product", {
    asin: asins.slice(0, 100).join(","),
    stats: "180",
    rating: "1",
    history: history ? "1" : "0",
    days: "365",
  });
  return { products: (data.products || []).map((p) => normalize(p, history)), tokensLeft: data.tokensLeft };
}

const val = (arr, i) => (Array.isArray(arr) && arr[i] != null && arr[i] >= 0 ? arr[i] : null);

function imageUrl(p) {
  if (Array.isArray(p.images) && p.images.length) {
    const im = p.images[0];
    const name = im.l || im.m || im;
    if (typeof name === "string") return `https://m.media-amazon.com/images/I/${name}`;
  }
  if (p.imagesCSV) return `https://m.media-amazon.com/images/I/${p.imagesCSV.split(",")[0]}`;
  return null;
}

function series(csv, divide) {
  if (!Array.isArray(csv)) return [];
  const out = [];
  for (let i = 0; i + 1 < csv.length; i += 2) {
    if (csv[i + 1] < 0) continue;
    out.push([keepaTimeToMs(csv[i]), divide ? csv[i + 1] / 100 : csv[i + 1]]);
  }
  return out;
}

export function normalize(p, withHistory) {
  const cur = p.stats?.current || [];
  const avg30 = p.stats?.avg30 || [];
  const avg90 = p.stats?.avg90 || [];
  const priceCents = val(cur, 18) ?? val(cur, 1) ?? val(cur, 0);
  const rank = val(cur, 3);
  const rank30 = val(avg30, 3);
  const rank90 = val(avg90, 3);
  const price90 = val(avg90, 1) ?? val(avg90, 0);
  const pick = (arr) => {
    const e = arr?.[1] ?? arr?.[0];
    return Array.isArray(e) && e[1] >= 0 ? e[1] : null;
  };
  const minP = pick(p.stats?.minInInterval ?? p.stats?.min);
  const maxP = pick(p.stats?.maxInInterval ?? p.stats?.max);

  const price = priceCents != null ? priceCents / 100 : null;
  const volatility = minP != null && maxP != null && price90 ? (maxP - minP) / price90 : 0;
  const rankTrend = rank30 && rank90 ? Math.max(-1, Math.min(1, (rank90 - rank30) / rank90)) : 0;
  const monthlySales = p.monthlySold > 0 ? p.monthlySold : estimateMonthlySales(rank);

  const out = {
    asin: p.asin,
    title: p.title || p.asin,
    brand: p.brand || "",
    image: imageUrl(p),
    url: `https://www.amazon.com/dp/${p.asin}`,
    category: p.categoryTree?.[0]?.name || "",
    price,
    rank,
    reviews: val(cur, 17) ?? 0,
    rating: val(cur, 16) != null ? val(cur, 16) / 10 : null,
    offers: val(cur, 11) ?? 1,
    monthlySales,
    salesIsEstimate: !(p.monthlySold > 0),
    revenue: price ? Math.round(monthlySales * price) : 0,
    referralPct: p.referralFeePercentage ?? p.referralFeePercent ?? 15,
    fbaFee: p.fbaFees?.pickAndPackFee > 0 ? p.fbaFees.pickAndPackFee / 100 : null,
    priceVolatility: Math.round(volatility * 100) / 100,
    rankTrend: Math.round(rankTrend * 100) / 100,
  };
  if (withHistory && p.csv) {
    out.history = { price: series(p.csv[1] || p.csv[0], true), rank: series(p.csv[3], false) };
  }
  return out;
}
