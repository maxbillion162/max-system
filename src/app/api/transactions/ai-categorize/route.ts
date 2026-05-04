import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = [
  "Housing", "Food", "Transport", "Entertainment",
  "Subscriptions", "Savings", "Health", "Shopping",
  "Personal", "Investing", "Misc",
];

export async function POST() {
  // 1. Fetch all uncategorized spending transactions (limit 100 per run)
  const { data: txs } = await supabase
    .from("transactions")
    .select("id, merchant, merchant_normalized, amount, date, category")
    .is("budget_category", null)
    .gt("amount", 0)
    .order("date", { ascending: false })
    .limit(100);

  if (!txs || txs.length === 0) {
    return NextResponse.json({ categorized: 0, aiUsed: 0 });
  }

  // 2. Apply existing confirmed merchant rules first (fast path)
  const { data: rules } = await supabase
    .from("merchant_rules")
    .select("merchant_pattern, category")
    .eq("confirmed", true);

  const ruleMap = new Map((rules ?? []).map(r => [r.merchant_pattern, r.category]));

  const ruleMatched: typeof txs = [];
  const needsAI:    typeof txs = [];

  for (const tx of txs) {
    if (ruleMap.has(tx.merchant_normalized)) {
      ruleMatched.push(tx);
    } else {
      needsAI.push(tx);
    }
  }

  // Apply rule matches
  for (const tx of ruleMatched) {
    await supabase
      .from("transactions")
      .update({ budget_category: ruleMap.get(tx.merchant_normalized) })
      .eq("id", tx.id);
  }

  if (needsAI.length === 0) {
    return NextResponse.json({ categorized: ruleMatched.length, aiUsed: 0 });
  }

  // 3. AI categorize the rest — batch in one Claude call
  const prompt = `You are categorizing personal finance transactions for Max's budget app.

Available categories: ${CATEGORIES.join(", ")}

Guidelines:
- Housing: rent, utilities, home supplies, repairs
- Food: groceries (Publix, Whole Foods), restaurants, fast food (Chipotle, McDonald's), delivery (DoorDash, Uber Eats), coffee
- Transport: gas stations (Shell, BP, Chevron), car insurance, parking, Uber/Lyft, tolls
- Entertainment: bars, clubs, concerts, movies, games, sporting events
- Subscriptions: Netflix, Spotify, gym memberships, software, any recurring monthly service
- Savings: bank transfers, savings deposits
- Health: pharmacy (CVS, Walgreens), doctor visits, dentist, vision
- Shopping: Amazon, Target, Walmart, clothing stores, electronics, general merchandise
- Personal: haircuts, barbers, personal care, beauty products
- Investing: brokerage transfers, Robinhood, investment purchases
- Misc: anything that genuinely doesn't fit above

Transactions to categorize:
${JSON.stringify(needsAI.map(t => ({ id: t.id, merchant: t.merchant, amount: t.amount, plaid_category: t.category })), null, 2)}

Return ONLY valid JSON array, no markdown, no explanation:
[{"id":"...","category":"...","confidence":0.9}]`;

  let aiResults: { id: string; category: string; confidence: number }[] = [];

  try {
    const response = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (response.content[0] as { text: string }).text.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      aiResults = JSON.parse(match[0]).filter(
        (r: { category: string }) => CATEGORIES.includes(r.category)
      );
    }
  } catch (err) {
    console.error("AI categorization failed:", err);
  }

  // 4. Save AI results + merchant rules (unconfirmed — pending Tinder review)
  for (const result of aiResults) {
    const tx = needsAI.find(t => t.id === result.id);
    if (!tx) continue;

    await supabase
      .from("transactions")
      .update({ budget_category: result.category })
      .eq("id", tx.id);

    // Save as unconfirmed rule — Tinder review will confirm it
    await supabase.from("merchant_rules").upsert({
      merchant_pattern: tx.merchant_normalized,
      category:         result.category,
      confirmed:        false,
    }, { onConflict: "merchant_pattern" });
  }

  return NextResponse.json({
    categorized: ruleMatched.length + aiResults.length,
    ruleMatched:  ruleMatched.length,
    aiUsed:       aiResults.length,
    remaining:    needsAI.length - aiResults.length,
  });
}
