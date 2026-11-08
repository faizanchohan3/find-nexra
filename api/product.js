import { product } from "../lib/service.js";
import { route, send, query } from "../lib/http.js";
import { httpErr } from "../lib/auth.js";

export default route(async (req, res) => {
  const q = query(req);
  const asin = (q.get("asin") || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) throw httpErr(400, "Send a 10-character ASIN");
  const costs = {};
  for (const k of ["supplierCost", "supplierPct", "freightPerUnit", "prepPerUnit", "adsPct", "returnsPct"]) {
    const v = q.get(k);
    if (v !== null && v !== "") costs[k] = Number(v);
  }
  const p = await product(asin, costs);
  if (!p) throw httpErr(404, "Product not found");
  send(res, 200, p);
});
