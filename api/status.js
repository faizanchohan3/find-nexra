import { cors, send } from "../lib/http.js";
import { CATEGORIES } from "../lib/categories.js";

export default function handler(req, res) {
  if (cors(req, res)) return;
  send(res, 200, {
    mode: process.env.KEEPA_API_KEY ? "live" : "demo",
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    accessCode: Boolean(process.env.ACCESS_CODE),
    categories: Object.keys(CATEGORIES),
  });
}
