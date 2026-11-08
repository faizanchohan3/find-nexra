# findNexra — AI Amazon Product Research & Store Manager (by Nexra LLC)

findNexra helps Amazon sellers find products, check profit, write listings, find suppliers, plan PPC and
launch, and manage their own Amazon store. Customers sign up, use free searches, and upgrade through
your Shopify store.

## What's included

| Area | Page | Features |
|---|---|---|
| Research | `/` | AI search in English or Roman Urdu, 25+ filters (price, reviews, rating, sales, revenue, rank, sellers, margin, ROI, profit, weight, size tier, listing age, exclude Amazon/brand, price volatility), opportunity score 0–100 with reasons, profit & ROI calculator, cost sensitivity grid, launch budget planner, seasonality, price/rank history, compare up to 4 products, watchlist, saved searches, CSV export |
| Account | `/account` | Sign up / log in, plan and usage meters, upgrade buttons, saved searches, extension key |
| AI Store Manager | `/studio` | Listing writer (title, bullets, description, backend terms, image brief), supplier finder + RFQ email + supplier CRM, quote analysis, PPC plan, 13-phase launch plan, free compliance check, saved projects |
| My Amazon store | `/amazon` | Connect Amazon Seller Central (Login with Amazon), listing audit, sales diagnosis chart |

### Plans

| Plan | Price | Shopify SKU |
|---|---|---|
| Free | $0 — 5 searches/day, 1 results page | — |
| Starter | $19/mo | `FINDNEXRA-STARTER` |
| Pro | $39/mo | `FINDNEXRA-PRO` |
| Store Manager | $99/mo — everything incl. Amazon store connection | `FINDNEXRA-STOREMANAGER` |

Limits are in `lib/plans.js`. Emails in `ADMIN_EMAILS` always get Store Manager.

Without keys the app runs in **demo mode** (sample products, sample AI answers, clearly labelled).

## 1. Get your keys

1. **Keepa API** (real Amazon data): keepa.com → API → choose a plan → copy the key.
2. **Claude API** (AI search and the Store Manager): console.anthropic.com → Billing → API Keys → Create key.
3. **Database** (accounts, plans, saved data): in Vercel → Storage → Create → **Upstash for Redis** (free tier
   is fine) → connect it to this project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
   Without a database, accounts only live in memory and disappear on every restart.

## 2. Deploy on Vercel

1. vercel.com → Add New → Project → import `faizanchohan3/find-nexra` → Deploy.
2. Vercel → Project → **Settings → Environment Variables**:

| Name | Required | Value |
|---|---|---|
| `SESSION_SECRET` | yes | long random text (e.g. 40+ random letters/numbers). Keep it secret; changing it logs everyone out |
| `KEEPA_API_KEY` | for live data | your Keepa key |
| `ANTHROPIC_API_KEY` | for AI | your Claude key |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | yes | added by the Upstash integration (or set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) |
| `ADMIN_EMAILS` | optional | your email(s), comma separated — full access without paying |
| `SHOPIFY_WEBHOOK_SECRET` | for paid plans | from step 3 below |
| `SHOP_URL` | optional | default `https://www.nexrallc.com` — upgrade buttons open `/products/findnexra-starter`, `-pro`, `-store-manager` |
| `UPGRADE_URL_STARTER` / `_PRO` / `_STOREMANAGER` | optional | override an upgrade link (e.g. a checkout link) |
| `APP_URL` | for Amazon connect | your app link, e.g. `https://findnexra.vercel.app` |
| `ALLOWED_ORIGINS` | optional | e.g. `https://www.nexrallc.com` if you call the API from your store |
| `AI_MODEL` | optional | default `claude-haiku-5-5` (search parsing) |
| `STUDIO_MODEL` | optional | default `claude-sonnet-5-5` (Store Manager) |
| `AMAZON_LWA_CLIENT_ID` / `AMAZON_LWA_CLIENT_SECRET` / `AMAZON_APP_ID` | for Amazon connect | from step 4 below |
| `AMAZON_APP_BETA` | optional | `true` while your SP-API app is in draft/testing |
| `AMAZON_MARKETPLACE_ID` / `AMAZON_SPAPI_ENDPOINT` | optional | default US: `ATVPDKIKX0DER` / `https://sellingpartnerapi-na.amazon.com` |

3. Redeploy after adding variables (Deployments → ⋯ → Redeploy).
4. Optional: Vercel → Domains → add `find.nexrallc.com` and add the DNS record Vercel shows.

## 3. Paid plans through Shopify

1. Create three products on nexrallc.com: **findNexra Starter** ($19), **findNexra Pro** ($39),
   **findNexra Store Manager** ($99), with the SKUs above and handles `findnexra-starter`,
   `findnexra-pro`, `findnexra-store-manager`. Turn off "Requires shipping".
2. For automatic monthly billing, install a subscriptions app (e.g. **Shopify Subscriptions**, free) and add a
   monthly plan to each product. Without it, each purchase gives 33 days of access.
3. Shopify Admin → Settings → Notifications → **Webhooks** → Create webhook:
   - Event **Order payment** → URL `https://YOUR-APP/api/shopify-webhook`, format JSON
   - Event **Order cancellation** → same URL
   - Copy the signing secret shown on that page into `SHOPIFY_WEBHOOK_SECRET` and redeploy.
4. Customers must check out with the **same email** they use on findNexra. If they buy first, the plan is
   applied when they sign up.

## 4. Amazon store connection (Store Manager plan)

1. sellercentral.amazon.com → Apps and Services → **Develop Apps** → register as a developer.
2. Create an app client (SP-API), roles: Product Listing, Selling Partner Insights / Sales.
3. OAuth Login URI: `https://YOUR-APP/amazon`; Redirect URI: `https://YOUR-APP/api/amazon?action=callback`.
4. Copy the LWA client ID, client secret and App ID into Vercel, set `APP_URL`, redeploy.
Sellers' refresh tokens are stored encrypted (AES-GCM, key from `SESSION_SECRET`).

## 5. Link it from Shopify

Point the **findNexra** header link (theme file `snippets/header_type2.liquid`) or the buttons on
`/pages/find-amazon-product` to your app link. Direct search: `https://YOUR-APP/?q=kitchen%20under%20%2440`.
The app allows being embedded in an iframe on nexrallc.com.

## Run locally

```
SESSION_SECRET=dev node dev-server.js
```
Open http://localhost:3000.

## Costs to know

- Keepa charges by tokens per search (finder query + products loaded). Tokens left are shown after each search.
- Claude charges per request; plan limits cap AI and Store Manager use per day.
- Upstash free tier covers small usage.

## Notes

- Monthly sales use Amazon's "bought in past month" when Keepa has it; otherwise estimated from rank (marked *).
- FBA fees come from Keepa when available, otherwise estimated — confirm in Amazon's revenue calculator.
- AI suggestions can be wrong; users send all supplier emails themselves.
- findNexra is not affiliated with Amazon. Figures are estimates for research only.
