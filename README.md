# findNexra — AI Amazon Product Finder (by Nexra LLC)

A complete product-research web app: customers describe what they want (English or Roman Urdu),
findNexra searches real Amazon data, scores every product 0–100 and estimates profit.

## What's included

| Feature | Where |
|---|---|
| AI search ("$20–60 kitchen, under 400 reviews, 25% margin" / "pet products kam reviews acha munafa") | `lib/ai.js` |
| Research filters: category, keyword, price, reviews, rating, sales, rank, sellers, margin | `public/index.html`, `lib/keepa.js` |
| Opportunity score (demand, competition, margin, price stability, trend, risk) with reasons | `lib/score.js` |
| Profit & ROI calculator (referral fee, FBA fee, supplier, freight, ads, returns) | product detail window |
| Price and sales-rank history charts | product detail window |
| Watchlist, sorting, CSV export | results page |
| Demo mode (works with no keys, clearly labelled) | `lib/demo.js` |
| Optional members-only access code | `ACCESS_CODE` setting |

## 1. Get your keys

1. **Keepa API** (real Amazon data): sign up at keepa.com → API → choose a plan → copy your API key.
2. **Claude API** (AI search and explanations): console.anthropic.com → add billing → API Keys → Create key.

Without keys the app runs in **demo mode** with sample products. Without only the Claude key, search still
works using the built-in parser (understands common English and Roman Urdu phrases).

## 2. Deploy on Vercel

1. Put this folder in a new GitHub repository (or drag the folder into vercel.com → Add New → Project).
2. In Vercel → Project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `KEEPA_API_KEY` | your Keepa key |
| `ANTHROPIC_API_KEY` | your Claude key |
| `AI_MODEL` | optional, default `claude-haiku-5-5` (cheaper); use `claude-sonnet-5-5` for smarter answers |
| `ACCESS_CODE` | optional — if set, users must enter this code (use it for paid members) |
| `ALLOWED_ORIGINS` | optional, e.g. `https://www.nexrallc.com` |

3. Click **Deploy**. You get a link like `https://findnexra.vercel.app`.
4. Optional: in Vercel → Domains, add `find.nexrallc.com` and add the DNS record Vercel shows in your domain settings.

## 3. Connect it to your Shopify store

Point the **findNexra** header link (theme file `snippets/header_type2.liquid`) or the buttons on
`/pages/find-amazon-product` to your Vercel link. You can open a search directly with
`https://YOUR-APP/?q=kitchen%20under%20%2440`.

## Run locally

```
node dev-server.js
```
Open http://localhost:3000. Set keys first with `export KEEPA_API_KEY=...` to use live data.

## Costs to know

- Keepa charges by "tokens". Each search uses tokens for the product-finder query plus the products
  loaded (up to 50 per search). The app shows tokens left after each search.
- Claude charges per request; each search makes up to two small requests.

## Notes

- Sales per month use Amazon's "bought in past month" figure when Keepa has it; otherwise they are
  estimated from Best Sellers Rank and marked with *.
- FBA fees come from Keepa when available, otherwise an estimate by price — users should confirm in
  Amazon's revenue calculator.
- findNexra is not affiliated with Amazon. Figures are estimates for research only.
