import { product } from "../lib/service.js";
import { cors, checkAccess, send } from "../lib/http.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!checkAccess(req, res)) return;
  const url = new URL(req.url, "http://x");
  const asin = (url.searchParams.get("asin") || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) return send(res, 400, { error: "Send a 10-character ASIN" });
  const costs = {};
  for (const k of ["supplierCost", "supplierPct", "freightPerUnit", "adsPct", "returnsPct"]) {
    const v = url.searchParams.get(k);
    if (v !== null && v !== "") costs[k] = Number(v);
  }
  try {
    const p = await product(asin, costs);
    if (!p) return send(res, 404, { error: "Product not found" });
    send(res, 200, p);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
