// Estimates, profit maths and the 0-100 opportunity score.
// All money values are in US dollars.

// Rough monthly unit sales from Best Sellers Rank when Amazon's own
// "bought in past month" number is not available. It is an estimate only.
export function estimateMonthlySales(rank) {
  if (!rank || rank <= 0) return 0;
  return Math.max(1, Math.round(300000 * Math.pow(rank, -0.8)));
}

export const DEFAULT_COSTS = {
  supplierPct: 30, // supplier cost as % of selling price (if user gives no cost)
  freightPerUnit: 1.0,
  adsPct: 10,
  returnsPct: 3,
};

export function profit(p, costs = {}) {
  const c = { ...DEFAULT_COSTS, ...costs };
  const price = p.price || 0;
  const referral = price * ((p.referralPct ?? 15) / 100);
  const fba = p.fbaFee ?? estimateFbaFee(price);
  const supplier = c.supplierCost != null ? Number(c.supplierCost) : price * (c.supplierPct / 100);
  const freight = Number(c.freightPerUnit) + Number(c.prepPerUnit || 0);
  const ads = price * (c.adsPct / 100);
  const returns = price * (c.returnsPct / 100);
  const totalCost = referral + fba + supplier + freight + ads + returns;
  const net = price - totalCost;
  const landed = supplier + freight;
  return {
    price: r2(price), referral: r2(referral), fba: r2(fba), supplier: r2(supplier),
    freight: r2(freight), ads: r2(ads), returns: r2(returns),
    net: r2(net),
    marginPct: price ? r1((net / price) * 100) : 0,
    roiPct: landed ? r1((net / landed) * 100) : 0,
    breakEven: r2(totalCost - ads - returns + price * ((c.adsPct + c.returnsPct) / 100)),
  };
}

export function estimateFbaFee(price) {
  if (price < 10) return 3.5;
  if (price < 25) return 4.5;
  if (price < 50) return 5.8;
  return 7.5;
}

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

// Score parts, each 0-1, weighted to a 0-100 total.
export function opportunityScore(p, margin) {
  const sales = p.monthlySales || 0;
  const demand = clamp(Math.log10(sales + 1) / Math.log10(3000)); // ~3000/mo = full marks
  const reviewComp = 1 - clamp(Math.log10((p.reviews || 0) + 1) / Math.log10(5000));
  const sellerComp = 1 - clamp(((p.offers || 1) - 1) / 20);
  const competition = 0.7 * reviewComp + 0.3 * sellerComp;
  const marginScore = clamp((margin.marginPct || 0) / 35);
  const stability = 1 - clamp((p.priceVolatility || 0) / 0.3);
  const trend = clamp(0.5 + (p.rankTrend || 0) / 2); // rankTrend +1 = improving fast
  const risk = clamp(1 - (p.rating && p.rating < 3.8 ? 0.4 : 0) - (p.price < 12 ? 0.3 : 0));

  const parts = {
    demand: Math.round(demand * 25),
    competition: Math.round(competition * 25),
    margin: Math.round(marginScore * 25),
    stability: Math.round(stability * 10),
    trend: Math.round(trend * 10),
    risk: Math.round(risk * 5),
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total: Math.min(100, total), parts };
}

export function reasons(p, margin, score) {
  const good = [], bad = [];
  if (p.monthlySales >= 300) good.push(`Strong demand (~${p.monthlySales.toLocaleString()} sales/month)`);
  else if (p.monthlySales < 60) bad.push("Low demand — may sell slowly");
  if (p.reviews < 300) good.push(`Few reviews (${p.reviews}) — easier to compete`);
  else if (p.reviews > 2000) bad.push(`Top sellers have many reviews (${p.reviews.toLocaleString()})`);
  if (margin.marginPct >= 25) good.push(`Healthy margin (${margin.marginPct}%)`);
  else if (margin.marginPct < 12) bad.push(`Thin margin (${margin.marginPct}%)`);
  if (p.offers > 12) bad.push(`Many sellers on the listing (${p.offers})`);
  if (p.priceVolatility > 0.2) bad.push("Price moves a lot — possible price war");
  if (p.rankTrend > 0.2) good.push("Sales rank improving lately");
  if (p.rankTrend < -0.2) bad.push("Sales rank getting worse lately");
  if (p.rating && p.rating < 3.8) bad.push(`Low rating (${p.rating}) — check complaints for a better version`);
  return { good, bad, verdict: score.total >= 70 ? "Strong opportunity" : score.total >= 50 ? "Worth a closer look" : "Risky" };
}

function r2(x) { return Math.round(x * 100) / 100; }
function r1(x) { return Math.round(x * 10) / 10; }
