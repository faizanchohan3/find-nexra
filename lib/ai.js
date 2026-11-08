// AI layer: turns a plain-English / Roman Urdu request into filters,
// and writes short buyer-friendly explanations. Uses the Claude API when
// ANTHROPIC_API_KEY is set, otherwise a built-in rule-based parser.
import { CATEGORIES, CATEGORY_WORDS } from "./categories.js";

const MODEL = () => process.env.AI_MODEL || "claude-haiku-5-5";

async function claude(system, user, maxTokens = 600) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL(), max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `AI error ${res.status}`);
  return (data.content || []).map((b) => b.text || "").join("");
}

function extractJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI did not return JSON");
  return JSON.parse(m[0]);
}

const FILTER_KEYS = ["keyword", "category", "brand", "excludeBrand", "sizeTier", "minPrice", "maxPrice", "minReviews", "maxReviews",
  "minRating", "maxRating", "minRank", "maxRank", "minSellers", "maxSellers", "minMonthlySales", "maxMonthlySales",
  "minRevenue", "maxRevenue", "minMargin", "minRoi", "minProfit", "maxWeightLb", "minAgeDays", "maxAgeDays", "maxVolatility", "minScore", "excludeAmazon"];
const TEXT_KEYS = new Set(["keyword", "category", "brand", "excludeBrand", "sizeTier"]);

function clean(f) {
  const out = {};
  for (const k of FILTER_KEYS) {
    const v = f[k];
    if (v === undefined || v === null || v === "") continue;
    if (k === "excludeAmazon") out[k] = v === true || v === "true";
    else if (TEXT_KEYS.has(k)) out[k] = String(v);
    else if (!isNaN(Number(v))) out[k] = Number(v);
  }
  if (out.category && !CATEGORIES[out.category]) delete out.category;
  return out;
}

export async function parseQuery(query, { ai = true } = {}) {
  if (!query || !query.trim()) return { filters: {}, via: "none" };
  if (ai && process.env.ANTHROPIC_API_KEY) {
    try {
      const system = `You convert an Amazon FBA seller's product-research request into JSON filters.
The request may be in English, Urdu or Roman Urdu (e.g. "kam reviews" = few reviews, "sasta" = cheap, "zyada bikne wala" = high sales, "munafa" = profit).
Reply with ONE JSON object only, using any of these keys (omit unknowns):
keyword (short product words, English), category (exactly one of: ${Object.keys(CATEGORIES).join(", ")}),
brand, excludeBrand, minPrice, maxPrice (USD), minReviews, maxReviews, minRating, maxRating (1-5), minRank, maxRank (best sellers rank),
minSellers, maxSellers, minMonthlySales, maxMonthlySales, minRevenue, maxRevenue (USD/month), minMargin, minRoi (percent), minProfit (USD/unit),
maxWeightLb, minAgeDays, maxAgeDays (listing age), maxVolatility (price change %), minScore (0-100), excludeAmazon (true if Amazon should not be a seller),
sizeTier ("Small standard"|"Large standard"|"Large bulky"|"Extra-large").
"lightweight"/"halka" = maxWeightLb 2. "new listings" = maxAgeDays 365. "no Amazon" = excludeAmazon true.
"few reviews" with no number = maxReviews 300. "good margin" = minMargin 25. "sells well" = minMonthlySales 300.`;
      const f = extractJson(await claude(system, query, 300));
      return { filters: clean(f), via: "ai" };
    } catch (e) {
      return { filters: ruleParse(query), via: "rules", aiError: e.message };
    }
  }
  return { filters: ruleParse(query), via: "rules" };
}

// Fallback parser for common phrasing.
export function ruleParse(q) {
  const f = {};
  const s = q.toLowerCase().replace(/,/g, "");
  let m;
  if ((m = s.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:-|–|to|se)\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:\$|dollar|usd)?/))) {
    f.minPrice = +m[1]; f.maxPrice = +m[2];
  } else {
    if ((m = s.match(/(?:under|below|less than|max|tak|se kam)\s*\$\s*(\d+)/)) || (m = s.match(/\$\s*(\d+)\s*(?:se kam|tak|or less)/))) f.maxPrice = +m[1];
    if ((m = s.match(/(?:over|above|more than|min)\s*\$\s*(\d+)/))) f.minPrice = +m[1];
  }
  if ((m = s.match(/(?:under|below|less than|max|kam)\s*(\d+)\s*reviews?/)) || (m = s.match(/(\d+)\s*(?:se kam|or fewer|or less)\s*reviews?/)) || (m = s.match(/reviews?\s*(?:under|below|<)\s*(\d+)/))) f.maxReviews = +m[1];
  else if (/(few|kam|low)\s*reviews?/.test(s)) f.maxReviews = 300;
  if ((m = s.match(/(\d+)\s*%\s*(?:margin|munafa|profit)/)) || (m = s.match(/(?:margin|munafa|profit)\s*(\d+)\s*%/))) f.minMargin = +m[1];
  else if (/(good|acha|achha|high)\s*(margin|munafa|profit)/.test(s)) f.minMargin = 25;
  if ((m = s.match(/(\d+(?:\.\d)?)\s*\+?\s*(?:star|rating)/))) f.minRating = +m[1];
  if ((m = s.match(/(\d+)\s*\+?\s*(?:sales|sold|bikri)/))) f.minMonthlySales = +m[1];
  else if (/(sells well|best ?seller|zyada bik|high demand|high sales)/.test(s)) f.minMonthlySales = 300;
  if ((m = s.match(/(?:under|max|less than)\s*(\d+)\s*sellers?/))) f.maxSellers = +m[1];
  else if (/(few|kam|low)\s*(sellers|competition)/.test(s)) f.maxSellers = 5;
  if (/(no amazon|without amazon|amazon (not|nahi))/.test(s)) f.excludeAmazon = true;
  if (/(lightweight|light weight|halka|small size)/.test(s)) f.maxWeightLb = 2;
  if (/(new listing|newly launched|naya|new products)/.test(s)) f.maxAgeDays = 365;
  if ((m = s.match(/(\d+)\s*%\s*roi/)) || (m = s.match(/roi\s*(\d+)/))) f.minRoi = +m[1];
  for (const [re, cat] of CATEGORY_WORDS) if (re.test(s)) { f.category = cat; break; }
  const stop = /\b(find|me|show|products?|items?|under|below|over|above|with|and|or|less|more|than|reviews?|margin|profit|sales|sold|sellers?|good|few|high|low|in|for|the|a|an|to|se|kam|acha|achha|zyada|chahiye|mujhe|wale|wala|ke|ki|ka|aur|stars?|rating|category|usd|dollars?|per|month|monthly|best|seller|sell|well|demand|competition|munafa|bikri|price)\b/g;
  const kw = s.replace(/\$?\d+(\.\d+)?\s*%?/g, " ").replace(/[-–$+]/g, " ").replace(stop, " ").replace(/\s+/g, " ").trim();
  if (kw && kw.length >= 3 && !f.category) f.keyword = kw.split(" ").slice(0, 4).join(" ");
  return f;
}

// Short AI explanation for the top products (one call for all).
export async function explain(products, query) {
  if (!process.env.ANTHROPIC_API_KEY || !products.length) return null;
  const rows = products.slice(0, 8).map((p) => ({
    asin: p.asin, title: p.title.slice(0, 90), price: p.price, monthlySales: p.monthlySales,
    reviews: p.reviews, rating: p.rating, sellers: p.offers, margin: p.profit.marginPct, score: p.score.total,
  }));
  try {
    const text = await claude(
      `You are an Amazon FBA product research assistant. For each product write one honest sentence (max 25 words) on why it is or isn't a good opportunity for the seller's request. Mention the biggest risk. Reply as JSON: {"<asin>": "<sentence>", ...}. Write in the same language style as the request (English or Roman Urdu).`,
      `Request: ${query || "(filters only)"}\nProducts: ${JSON.stringify(rows)}`,
      900
    );
    return extractJson(text);
  } catch {
    return null;
  }
}
