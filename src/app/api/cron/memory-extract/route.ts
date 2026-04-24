/**
 * Memory auto-extract cron.
 *
 * Once a day, M.A.X. reads the last ~24h of unified chat_messages and uses
 * Claude Haiku to extract durable facts about Max worth persisting — the
 * kinds of things a good assistant remembers without being told twice.
 *
 * Durable = preferences, relationships, decisions, recurring context.
 * Ephemeral = crypto prices, task counts, today's weather.
 *
 * Deduped against existing memories by case-insensitive substring match.
 * No Telegram, no bell — this is silent plumbing that just makes M.A.X.
 * smarter over time. Visible via Settings → Behind the Scenes.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACT_PROMPT = `You extract durable facts about Max from a recent conversation log. Output ONLY a JSON array of short facts worth permanently remembering, or [] if none.

INCLUDE:
- Preferences ("Max prefers late-afternoon meetings")
- People + relationships ("Sarah is Max's girlfriend's sister")
- Decisions made ("Decided to max Roth IRA before investing aggressively")
- Recurring context ("Works remote on Wednesdays")
- Constraints or rules Max set ("Won't eat out more than twice a week")

EXCLUDE:
- Ephemeral state (today's crypto price, current weather, open task count)
- Stuff trivially re-derivable from the app's own data
- Casual small talk
- Anything M.A.X. asked Max to confirm that he didn't explicitly confirm
- Vague impressions ("seems interested in X")

Each fact: one clear sentence, under 180 characters, third-person factual ("Max X...").

Return a JSON array of strings, nothing else. No prose, no markdown, no explanation. Empty array if nothing qualifies.

Example outputs:
["Max prefers concise Telegram responses under 120 words.", "Max's emergency fund target is $10K before aggressive investing."]
[]`;

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ extracted: 0, reason: "no API key" });
  }

  // Pull ~last 24h of messages. If nothing, quietly exit.
  const since = new Date(Date.now() - 26 * 3_600_000).toISOString();
  const { data: msgs } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);

  if (!msgs || msgs.length < 2) {
    return NextResponse.json({ extracted: 0, reason: "no recent messages" });
  }

  // Build a compact transcript
  const transcript = (msgs as { role: string; content: string }[])
    .map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 600)}`)
    .join("\n");

  // Ask Claude for candidate facts
  let candidates: string[] = [];
  try {
    const res = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system:     EXTRACT_PROMPT,
      messages:   [{ role: "user", content: `CONVERSATION LOG:\n${transcript}` }],
    });
    const block = res.content.find(c => c.type === "text") as Anthropic.TextBlock | undefined;
    const text  = block?.text?.trim() ?? "[]";
    // Tolerate the model wrapping in fences
    const match = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : "[]");
    if (Array.isArray(parsed)) {
      candidates = parsed.filter((f): f is string => typeof f === "string" && f.length > 6 && f.length < 400);
    }
  } catch {
    return NextResponse.json({ extracted: 0, reason: "extraction failed" });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ extracted: 0, reason: "nothing notable" });
  }

  // Dedupe against existing memories
  const { data: existing } = await supabase
    .from("memories")
    .select("content")
    .order("created_at", { ascending: false })
    .limit(500);
  const existingTexts = ((existing ?? []) as { content: string }[]).map(m => m.content.toLowerCase());

  function isDuplicate(fact: string): boolean {
    const f = fact.toLowerCase();
    return existingTexts.some(e =>
      // Either direction of substring overlap counts as a dup
      e.includes(f) || f.includes(e) ||
      // Or 70%+ word overlap on normalized token sets
      wordOverlapRatio(f, e) >= 0.7
    );
  }

  const newFacts = candidates.filter(f => !isDuplicate(f));
  if (newFacts.length === 0) {
    return NextResponse.json({ extracted: 0, reason: "all duplicates", considered: candidates.length });
  }

  // Insert
  const rows = newFacts.map(content => ({
    content,
    tags: ["auto-extract"],
  }));
  const { error } = await supabase.from("memories").insert(rows);
  if (error) {
    return NextResponse.json({ extracted: 0, reason: error.message });
  }

  // Log to activity feed so it shows in Settings → Behind the Scenes
  await supabase.from("activity_log").insert({
    type: "memory_extract",
    description: `Auto-extracted ${newFacts.length} memor${newFacts.length === 1 ? "y" : "ies"} from recent conversations.`,
    detail: { facts: newFacts },
  }).then(() => {}, () => {});

  return NextResponse.json({
    extracted:  newFacts.length,
    considered: candidates.length,
    facts:      newFacts,
  });
}

/** Jaccard-ish overlap on word tokens (drops short/noise tokens). */
function wordOverlapRatio(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length >= 4));
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const w of ta) if (tb.has(w)) overlap++;
  return overlap / Math.min(ta.size, tb.size);
}
