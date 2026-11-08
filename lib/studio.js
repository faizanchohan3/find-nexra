// AI Store Manager tools. Each returns structured JSON. Uses Claude when
// ANTHROPIC_API_KEY is set; otherwise returns a useful template (demo mode).

const MODEL = () => process.env.STUDIO_MODEL || process.env.AI_MODEL || "claude-sonnet-5-5";

async function claudeJson(system, user, maxTokens = 2500) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL(), max_tokens: maxTokens, system: system + "\nReply with ONE valid JSON object only, no markdown.", messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `AI error ${res.status}`);
  const text = (data.content || []).map((b) => b.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI returned an unexpected answer — try again");
  return JSON.parse(m[0]);
}
const ai = () => Boolean(process.env.ANTHROPIC_API_KEY);
const s = (v, max = 2000) => String(v ?? "").slice(0, max).trim();

// ---------- Amazon listing compliance (rule-based, always runs) ----------
const BANNED = [
  [/\b(best|#1|number one|top rated|best ?seller)\b/i, "Superlative claims like “best” or “#1” are not allowed"],
  [/\b(guarantee[d]?|warranty|money back|risk[- ]free)\b/i, "Guarantee / money-back wording is not allowed in listing copy"],
  [/\b(cure[sd]?|treat(s|ment)?|heal(s|ing)?|prevent(s)?\s+(disease|cancer|covid)|fda approved|clinically proven)\b/i, "Medical or health claims need proof and are often removed"],
  [/\b(anti[- ]?bacterial|antimicrobial|kills? (germs|bacteria|viruses)|pesticide)\b/i, "Pesticide / antimicrobial claims need EPA registration"],
  [/\b(eco[- ]?friendly|biodegradable|non[- ]?toxic|chemical[- ]free)\b/i, "Environmental claims need certification proof"],
  [/\b(free shipping|sale|discount|cheap|lowest price|limited time)\b/i, "Price, promotion or shipping wording is not allowed"],
  [/[\u{1F300}-\u{1FAFF}☀-➿]/u, "Emojis and special symbols are not allowed"],
  [/\b(amazon|prime)\b/i, "Do not mention Amazon or Prime in your copy"],
];
export function complianceCheck({ title = "", bullets = [], description = "", searchTerms = "" }) {
  const issues = [];
  const check = (field, text) => {
    for (const [re, msg] of BANNED) if (re.test(text)) issues.push({ field, problem: msg, found: (text.match(re) || [""])[0] });
    if (/\b[A-Z]{5,}\b/.test(text) && field !== "searchTerms") issues.push({ field, problem: "Avoid words in ALL CAPS", found: text.match(/\b[A-Z]{5,}\b/)[0] });
  };
  check("title", title);
  if (title.length > 200) issues.push({ field: "title", problem: `Title is ${title.length} characters — keep it under 200 (most categories) `, found: "" });
  if (/[!$?_{}^¬¦]/.test(title)) issues.push({ field: "title", problem: "Title has special characters (! $ ? _ { } ^) Amazon can suppress", found: title.match(/[!$?_{}^¬¦]/)[0] });
  bullets.forEach((b, i) => { check(`bullet ${i + 1}`, b); if (b.length > 500) issues.push({ field: `bullet ${i + 1}`, problem: "Bullet longer than 500 characters", found: "" }); });
  check("description", description);
  const bytes = Buffer.byteLength(searchTerms, "utf8");
  if (bytes > 249) issues.push({ field: "searchTerms", problem: `Search terms are ${bytes} bytes — Amazon only indexes 249`, found: "" });
  if (/[,;]/.test(searchTerms)) issues.push({ field: "searchTerms", problem: "Use spaces, not commas, in search terms", found: "" });
  return { ok: issues.length === 0, issues };
}

// ---------- Tools ----------
export const TOOLS = {
  async listing(i) {
    const input = { product: s(i.product, 200), brand: s(i.brand, 60), features: s(i.features), keywords: s(i.keywords, 600), audience: s(i.audience, 200), tone: s(i.tone, 60) || "clear and trustworthy" };
    if (!input.product) throw Object.assign(new Error("Tell me the product name"), { status: 400 });
    let out;
    if (ai()) {
      out = await claudeJson(
        `You are an expert Amazon US listing copywriter. Write a keyword-rich, policy-compliant listing. Rules: title ≤ 200 characters, starts with brand, no promotional words, no claims you cannot prove, no emojis, no ALL CAPS. 5 bullets, each starting with a short benefit in capitals-free title case followed by a colon, each ≤ 250 characters. Description 1000-1500 characters plain text. searchTerms: space-separated, no brand names, no repeats of title words, ≤ 249 bytes. imageBrief: 7 items (main image on pure white, infographic, lifestyle, size/dimensions, in-use, comparison, what's in the box), each with "shot" and "notes". Also give "keywordsUsed" (array).
JSON keys: title, bullets (array of 5), description, searchTerms, imageBrief (array of {shot, notes}), keywordsUsed.`,
        JSON.stringify(input), 3000);
    } else {
      const b = input.brand || "YourBrand", p = input.product;
      out = {
        title: `${b} ${p} – ${input.keywords.split(/[,\n]/).slice(0, 3).map((x) => x.trim()).filter(Boolean).join(", ") || "Durable, Easy to Use"}`.slice(0, 200),
        bullets: ["Built To Last: describe the material and why it lasts.", "Easy To Use: explain setup in one sentence.", "Perfect Size: give exact dimensions and what it fits.", "Versatile: list 3 places or ways customers use it.", "What You Get: list exactly what is in the box."],
        description: `${b} ${p}. (Demo text — add your Claude API key to get a full AI-written description using your features and keywords.)`,
        searchTerms: input.keywords.replace(/[,;\n]+/g, " ").replace(/\s+/g, " ").slice(0, 240),
        imageBrief: ["Main image on pure white (85% of frame)", "Infographic of top 3 features", "Lifestyle photo in use", "Dimensions with a ruler/hand for scale", "Close-up of material quality", "Comparison vs generic product", "Everything included in the box"].map((x) => ({ shot: x, notes: "" })),
        keywordsUsed: [], demo: true,
      };
    }
    out.compliance = complianceCheck(out);
    return out;
  },

  async supplier(i) {
    const input = { product: s(i.product, 200), specs: s(i.specs), targetCost: s(i.targetCost, 20), moq: s(i.moq, 20), destination: s(i.destination, 80) || "Amazon FBA warehouse, USA", yourName: s(i.yourName, 80), company: s(i.company, 80) || "Nexra LLC" };
    if (!input.product) throw Object.assign(new Error("Tell me the product"), { status: 400 });
    const q = encodeURIComponent(input.product);
    const links = [
      { site: "Alibaba.com", url: `https://www.alibaba.com/trade/search?SearchText=${q}` },
      { site: "Alibaba (Verified suppliers)", url: `https://www.alibaba.com/trade/search?SearchText=${q}&assessmentCompany=true` },
      { site: "Made-in-China.com", url: `https://www.made-in-china.com/products-search/hot-china-products/${q}.html` },
      { site: "Global Sources", url: `https://www.globalsources.com/searchList/products?query=${q}` },
      { site: "1688.com (China domestic)", url: `https://s.1688.com/selloffer/offer_search.htm?keywords=${q}` },
      { site: "ThomasNet (USA manufacturers)", url: `https://www.thomasnet.com/search.html?what=${q}` },
    ];
    const checklist = [
      "Verified / Trade Assurance supplier, 3+ years on the platform",
      "Factory (manufacturer), not only a trading company — ask for a factory video",
      "Business license and export license match the company name",
      "Product certificates you need (e.g. CPC for kids, FDA for food contact, FCC for electronics)",
      "Order a sample from 2–3 suppliers before choosing",
      "Pre-shipment inspection (e.g. QIMA / V-Trust) on the first order",
      "Use Trade Assurance or escrow — never 100% upfront by bank transfer",
      "Confirm FBA labelling, carton size limits and packaging",
    ];
    let email;
    if (ai()) {
      email = await claudeJson(
        `Write a short, professional first-contact RFQ email from an Amazon seller to a ${"manufacturer"} on Alibaba. Ask for: unit price at the stated MOQ and at 2x MOQ, sample cost and time, production lead time, packaging/FBA labelling, certificates, payment terms. Polite, specific, under 200 words. Also write 6 smart questions to ask on a follow-up call. JSON keys: subject, body, followUpQuestions (array).`,
        JSON.stringify(input), 1200);
    } else {
      email = {
        subject: `RFQ: ${input.product} — ${input.moq || "500"} units`,
        body: `Hello,\n\nI'm ${input.yourName || "[your name]"} from ${input.company}. We sell on Amazon USA and are looking for a manufacturer for ${input.product}${input.specs ? ` (${input.specs})` : ""}.\n\nCould you please share:\n1. Unit price for ${input.moq || "500"} pcs and for ${input.moq ? input.moq * 2 : "1000"} pcs\n2. Sample cost and how fast you can send it\n3. Production lead time\n4. Packaging options and whether you can apply FBA labels\n5. Certificates you have for this product\n6. Payment terms (Trade Assurance preferred)\n\nOur target price is ${input.targetCost ? "$" + input.targetCost : "[target]"} per unit, delivered to ${input.destination}.\n\nThank you,\n${input.yourName || "[your name]"}\n${input.company}`,
        followUpQuestions: ["Are you the factory or a trading company?", "Can you show a factory video?", "What is your defect rate and how do you handle defects?", "Can you customise the logo and packaging?", "What is the MOQ for custom packaging?", "Can you ship DDP to an Amazon warehouse?"],
        demo: true,
      };
    }
    return { links, checklist, email };
  },

  async quote(i) {
    const replies = s(i.replies, 12000);
    if (!replies) throw Object.assign(new Error("Paste one or more supplier replies"), { status: 400 });
    if (ai()) {
      return claudeJson(
        `You analyse supplier quotes for an Amazon FBA seller. Supplier replies are pasted (may be several, separated by lines). Extract each supplier's offer and spot red flags (vague pricing, 100% upfront, no Trade Assurance, unrealistic lead times, missing certificates, much cheaper than others). Recommend which to sample and draft a short negotiation reply to the best one.
JSON keys: suppliers (array of {name, unitPrice, moq, sampleCost, leadTime, paymentTerms, shipping, certificates, redFlags (array), score (0-10)}), recommendation, negotiationReply.`,
        `Target landed cost: ${s(i.targetCost, 20) || "not given"}\nReplies:\n${replies}`, 2500);
    }
    const price = replies.match(/\$\s?(\d+(?:\.\d+)?)/);
    const moq = replies.match(/moq[^\d]{0,10}(\d[\d,]*)/i);
    const lead = replies.match(/(\d+)\s*(?:-\s*\d+\s*)?(days|weeks)/i);
    return {
      suppliers: [{ name: "Supplier 1", unitPrice: price ? "$" + price[1] : "not found", moq: moq ? moq[1] : "not found", sampleCost: "", leadTime: lead ? lead[0] : "not found", paymentTerms: /100%/.test(replies) ? "100% upfront" : "", shipping: "", certificates: "", redFlags: /100%/.test(replies) ? ["Asks for 100% upfront payment"] : [], score: 5 }],
      recommendation: "Demo mode: basic extraction only. Add your Claude API key for a full comparison of every supplier.",
      negotiationReply: "", demo: true,
    };
  },

  async ppc(i) {
    const input = { product: s(i.product, 200), price: Number(i.price) || 0, marginPct: Number(i.marginPct) || 25, keywords: s(i.keywords, 1500), dailyBudget: Number(i.dailyBudget) || 30, competitors: s(i.competitors, 600) };
    if (!input.product) throw Object.assign(new Error("Tell me the product"), { status: 400 });
    const targetAcos = Math.max(10, Math.min(60, Math.round(input.marginPct)));
    const maxCpc = input.price ? Math.round(input.price * (targetAcos / 100) * 0.1 * 100) / 100 : 0.8; // assumes ~10% conversion
    if (ai()) {
      const out = await claudeJson(
        `You are an Amazon PPC strategist. Build a 30-day launch plan for Sponsored Products. Break-even ACoS = product margin. Use the seller's keywords and invent sensible ones if few. Group keywords into exact/phrase/broad campaigns, add an auto campaign and a product-targeting campaign (ASINs or categories). Suggest starting bids (USD) from the max CPC given, daily budget split, negative keywords, and a week-by-week optimisation schedule.
JSON keys: targetAcos, campaigns (array of {name, type, match, dailyBudget, bid, targets (array)}), negativeKeywords (array), weeklyPlan (array of {week, actions (array)}), tips (array).`,
        JSON.stringify({ ...input, targetAcos, maxCpc }), 3000);
      return out;
    }
    const kws = input.keywords.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    const b = input.dailyBudget;
    return {
      targetAcos, demo: true,
      campaigns: [
        { name: `${input.product} – Auto`, type: "Sponsored Products", match: "Auto", dailyBudget: Math.round(b * 0.3), bid: maxCpc, targets: ["close-match", "loose-match", "substitutes", "complements"] },
        { name: `${input.product} – Exact`, type: "Sponsored Products", match: "Exact", dailyBudget: Math.round(b * 0.4), bid: Math.round(maxCpc * 1.2 * 100) / 100, targets: kws.slice(0, 10) },
        { name: `${input.product} – Phrase`, type: "Sponsored Products", match: "Phrase", dailyBudget: Math.round(b * 0.2), bid: maxCpc, targets: kws.slice(0, 10) },
        { name: `${input.product} – Product targeting`, type: "Sponsored Products", match: "ASIN", dailyBudget: Math.round(b * 0.1), bid: Math.round(maxCpc * 0.8 * 100) / 100, targets: input.competitors.split(/[,\s]+/).filter(Boolean) },
      ],
      negativeKeywords: ["free", "cheap", "used", "diy", "how to"],
      weeklyPlan: [
        { week: 1, actions: ["Launch all 4 campaigns", "Do not change bids for 7 days — collect data"] },
        { week: 2, actions: ["Move auto search terms with sales into Exact", "Add search terms with 10+ clicks and no sales as negatives"] },
        { week: 3, actions: [`Lower bids 10–20% on keywords above ${targetAcos}% ACoS`, "Raise bids 10% on keywords below half your target ACoS"] },
        { week: 4, actions: ["Pause keywords with 20+ clicks and no sales", "Shift budget to the best campaign"] },
      ],
      tips: [`Break-even ACoS is about ${targetAcos}% (your margin)`, "Expect higher ACoS in the first 2 weeks while you get reviews"],
    };
  },

  async launch(i) {
    const input = { product: s(i.product, 200), budget: s(i.budget, 20), launchDate: s(i.launchDate, 20), experience: s(i.experience, 40) || "beginner" };
    const phases = [
      ["Product validation", ["Opportunity score 60+ in findNexra", "Check 1-star reviews of top 5 sellers for problems to fix", "Confirm profit with real supplier quotes"]],
      ["Brand & legal", ["Choose brand name, check USPTO", "Apply for Amazon Brand Registry (trademark filed)", "Get UPC/GTIN barcodes (GS1)"]],
      ["Supplier & samples", ["Contact 5–10 suppliers", "Order 2–3 samples", "Pick supplier; agree price, MOQ, lead time"]],
      ["Compliance", ["Check category approval and required certificates", "Prepare safety data / test reports if needed"]],
      ["Packaging & labels", ["Design packaging and insert card", "FBA labels and carton labels", "Carton size/weight within FBA limits"]],
      ["Production & inspection", ["Pay deposit via Trade Assurance", "Pre-shipment inspection", "Pay balance after passing inspection"]],
      ["Shipping & customs", ["Choose freight (air/sea), get DDP quote", "Customs bond / importer of record", "Create FBA shipment plan"]],
      ["Listing creation", ["Write listing with findNexra listing writer", "Run compliance check", "Upload 7 images + A+ content"]],
      ["Pricing", ["Set launch price and coupon", "Confirm break-even price"]],
      ["Inventory arrival", ["Track check-in at FBA warehouse", "Fix any stranded or suppressed inventory"]],
      ["Launch & PPC", ["Start PPC plan from findNexra", "Enroll in Vine for early reviews (if Brand Registered)"]],
      ["Optimise (weeks 2–6)", ["Weekly PPC optimisation", "Improve main image / title based on click-through", "Answer customer questions"]],
      ["Reorder & scale", ["Reorder when 60 days of stock remain", "Add variations or bundles", "Expand to Canada/UK if profitable"]],
    ].map(([name, tasks], idx) => ({ phase: idx + 1, name, tasks }));
    if (!ai()) return { phases, notes: "Standard 13-phase plan. Add your Claude API key for a plan tailored to your product, budget and dates.", demo: true };
    const out = await claudeJson(
      `You are an Amazon FBA launch coach. Personalise this 13-phase launch plan for the product, budget, experience and launch date. Keep the same 13 phases and order; adjust tasks (3–5 per phase, specific to the product), add an estimated duration in days and an estimated cost for each phase, and list the biggest risks.
JSON keys: phases (array of {phase, name, days, estCost, tasks (array)}), totalDays, risks (array), notes.`,
      JSON.stringify({ ...input, basePlan: phases }), 3500);
    return out;
  },
};
