// Sample products so the app works before a Keepa key is added.
// Clearly marked as demo data in the UI. Not real Amazon listings.
import { estimateMonthlySales } from "./score.js";

const ITEMS = [
  ["Kitchen & Dining", ["Silicone Utensil Set", "Herb Keeper", "Garlic Press Rocker", "Oil Sprayer Bottle", "Collapsible Colander", "Magnetic Knife Strip", "Egg Bites Mold", "Pour Over Coffee Stand"]],
  ["Home & Kitchen", ["Under Sink Organizer", "Drawer Divider Set", "Shoe Rack Stackable", "Closet Shelf Divider", "Cable Management Box", "Over Door Hook Rack"]],
  ["Beauty & Personal Care", ["Ice Roller Face", "Heatless Hair Curler", "Scalp Massager Brush", "Makeup Brush Cleaner", "Nail Drill Kit"]],
  ["Sports & Outdoors", ["Resistance Bands Set", "Ankle Weights Pair", "Yoga Wheel", "Jump Rope Weighted", "Camping Lantern Rechargeable", "Grip Strengthener"]],
  ["Pet Supplies", ["Lick Mat for Dogs", "Cat Window Perch", "Pet Hair Remover Roller", "Dog Poop Bag Holder", "Slow Feeder Bowl"]],
  ["Toys & Games", ["Busy Board Toddler", "Magnetic Tiles Set", "Fidget Toy Pack", "Sensory Bin Kit"]],
  ["Office Products", ["Monitor Stand Riser", "Desk Mat Large", "Label Maker Tape", "Cable Clips Desk"]],
  ["Baby", ["Baby Bottle Drying Rack", "Teething Toys Set", "Stroller Organizer", "Bath Toy Storage"]],
  ["Patio, Lawn & Garden", ["Plant Watering Spikes", "Garden Kneeler Seat", "Self Watering Planter", "Bird Feeder Window"]],
  ["Automotive", ["Car Seat Gap Filler", "Trunk Organizer", "Phone Mount Vent", "Tire Inflator Portable"]],
  ["Electronics", ["Wireless Charging Stand", "USB C Hub 7in1", "Bluetooth Item Tracker", "Webcam Cover Slide"]],
  ["Health & Household", ["Pill Organizer Weekly", "Posture Corrector", "Foot Massager Roller", "Reusable Cleaning Cloths"]],
];

function rng(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

let CACHE = null;
export function demoCatalog() {
  if (CACHE) return CACHE;
  const out = [];
  let n = 1;
  for (const [category, names] of ITEMS) {
    for (const name of names) {
      const r = rng(n * 7919);
      const price = Math.floor(9 + r() * 61) + 0.99;
      const rank = Math.round(500 + Math.pow(r(), 1.6) * 90000);
      const reviews = Math.round(Math.pow(r(), 2) * 6000);
      const rating = Math.round((3.5 + r() * 1.4) * 10) / 10;
      const offers = 1 + Math.round(Math.pow(r(), 2) * 18);
      const monthlySales = estimateMonthlySales(rank);
      const vol = Math.round(r() * 0.35 * 100) / 100;
      const trend = Math.round((r() * 2 - 1) * 0.6 * 100) / 100;
      const asin = "DEMO" + String(n).padStart(6, "0");
      const now = Date.now();
      const priceHist = [], rankHist = [];
      for (let d = 365; d >= 0; d -= 7) {
        const t = now - d * 864e5;
        priceHist.push([t, Math.round(price * (1 + (r() - 0.5) * vol) * 100) / 100]);
        rankHist.push([t, Math.max(50, Math.round(rank * (1 + trend * (d / 365)) * (0.8 + r() * 0.4)))]);
      }
      out.push({
        asin, title: `${name} — Demo Product`, brand: "Sample", image: null,
        url: "https://www.amazon.com/s?k=" + encodeURIComponent(name),
        category, price, rank, reviews, rating, offers, monthlySales, salesIsEstimate: true,
        revenue: Math.round(monthlySales * price), referralPct: 15, fbaFee: null,
        priceVolatility: vol, rankTrend: trend, demo: true,
        history: { price: priceHist, rank: rankHist },
      });
      n++;
    }
  }
  CACHE = out;
  return out;
}

export function demoSearch(f) {
  const kw = (f.keyword || "").toLowerCase().split(/\s+/).filter(Boolean);
  return demoCatalog().filter((p) =>
    (f.minPrice == null || p.price >= f.minPrice) &&
    (f.maxPrice == null || p.price <= f.maxPrice) &&
    (f.minReviews == null || p.reviews >= f.minReviews) &&
    (f.maxReviews == null || p.reviews <= f.maxReviews) &&
    (f.minRating == null || p.rating >= f.minRating) &&
    (f.maxRank == null || p.rank <= f.maxRank) &&
    (f.maxSellers == null || p.offers <= f.maxSellers) &&
    (f.minMonthlySales == null || p.monthlySales >= f.minMonthlySales) &&
    (!f.category || p.category === f.category) &&
    (!kw.length || kw.some((w) => p.title.toLowerCase().includes(w)))
  );
}
