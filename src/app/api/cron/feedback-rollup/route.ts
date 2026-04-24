/**
 * Feedback rollup cron — the last piece of the Phase 3 learning loop.
 *
 * Once a day, reads recent feedback rows (👍 / 👎 + optional notes from
 * AI outputs around the app), groups them by artifact_type, and asks
 * Claude Haiku to synthesize learned preferences into concise
 * instructions. Those get written back to the memories table tagged
 * `learned_preference`, where the context injection already picks them
 * up and feeds them into every subsequent agent call.
 *
 * Net effect: M.A.X. measurably improves at each kind of AI output
 * (dashboard brief, feed top 3, email summaries once they ship) the
 * more Max clicks thumbs-up / thumbs-down.
 *
 * Deduped against existing learned_preference memories via substring +
 * 70% word-overlap (same dedup the memory-extract cron uses).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Pretty name for each artifact_type — used in the synth prompt to orient Claude. */
const TYPE_LABELS: Record<string, string> = {
  dashboard_brief:   "the daily dashboard brief (short morning intelligence lines)",
  feed_top3:         "M.A.X.'s Top 3 article picks in the Intel Feed",
  email_summary:     "one-line AI summaries attached to each email",
  email_briefing:    "the top-of-page email briefing / action-required ranking",
  dashboard_insight: "general insights surfaced on the dashboard",
  brief:             "the proactive brief sent on chat open",
  feed_summary:      "article summaries in the feed",
};

interface FeedbackRow {
  id:            number;
  artifact_type: string;
  artifact_id:   string | null;
  rating:        number;
  note:          string | null;
  metadata:      Record<string, unknown> | null;
  created_at:    string;
}

const SYNTH_SYSTEM = `You analyze user feedback on an AI assistant's outputs and extract durable preferences that will guide future generations. Your output is instructions the assistant will follow forever, so be precise and narrow.

Rules:
- Output ONLY a JSON array of short preference statements, or [] if no clear pattern.
- Each statement is one sentence, under 200 characters, imperative, specific.
- Prefer concrete directives over vague impressions. "Keep dashboard briefs under 4 lines" beats "Max likes concise briefs."
- Never state preferences that aren't supported by explicit notes or consistent rating patterns.
- If thumbs-down notes disagree with each other, extract nothing — ambiguity is the enemy.
- No prose, no markdown, no commentary. JSON array only.

Example good outputs:
["For feed_top3 picks, weight crypto and AI news more heavily than politics.", "Keep dashboard briefs to 4 lines maximum; no more."]
[]`;

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ learned: 0, reason: "no API key" });
  }

  // Pull feedback from the last 14 days
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data: feedback, error: fbErr } = await supabase
    .from("feedback")
    .select("id, artifact_type, artifact_id, rating, note, metadata, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (fbErr) {
    return NextResponse.json({ learned: 0, reason: fbErr.message }, { status: 200 });
  }
  if (!feedback || feedback.length < 3) {
    return NextResponse.json({ learned: 0, reason: "not enough feedback yet", count: feedback?.length ?? 0 });
  }

  // Group by artifact_type
  const groups = new Map<string, FeedbackRow[]>();
  for (const row of feedback as FeedbackRow[]) {
    const key = row.artifact_type;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Pull existing learned_preference memories for dedup
  const { data: existing } = await supabase
    .from("memories")
    .select("content, tags")
    .order("created_at", { ascending: false })
    .limit(500);
  const existingLearned = ((existing ?? []) as { content: string; tags: string[] | null }[])
    .filter(m => Array.isArray(m.tags) && m.tags.includes("learned_preference"))
    .map(m => m.content.toLowerCase());

  const allNewPrefs: { type: string; content: string }[] = [];
  const perTypeStats: Record<string, { up: number; down: number; notes: number; learned: number }> = {};

  for (const [type, rows] of groups) {
    const up    = rows.filter(r => r.rating ===  1);
    const down  = rows.filter(r => r.rating === -1);
    const notes = rows.filter(r => r.note && r.note.trim().length > 0);

    perTypeStats[type] = { up: up.length, down: down.length, notes: notes.length, learned: 0 };

    // Skip types without enough signal
    //   - At least 3 total ratings AND
    //   - At least 1 note (explicit "what was off") OR a strong lopsided ratio (4+ downs vs 0 ups)
    const hasSignal = rows.length >= 3 && (notes.length >= 1 || (down.length >= 4 && up.length === 0));
    if (!hasSignal) continue;

    const label = TYPE_LABELS[type] ?? `outputs of type "${type}"`;

    // Build compact evidence packet for Claude
    const evidence: string[] = [];
    evidence.push(`Output type: ${label}`);
    evidence.push(`Rated ${up.length} 👍 and ${down.length} 👎 in the last 14 days.`);

    if (notes.length > 0) {
      evidence.push(`User notes on specific outputs:`);
      for (const n of notes.slice(0, 12)) {
        const rating = n.rating === 1 ? "👍" : "👎";
        const metaHint = n.metadata && typeof n.metadata === "object"
          ? summarizeMetadata(n.metadata as Record<string, unknown>)
          : "";
        evidence.push(`  ${rating}${metaHint ? ` [${metaHint}]` : ""}: "${(n.note ?? "").slice(0, 200)}"`);
      }
    }

    // Ask Claude for preferences
    let candidates: string[] = [];
    try {
      const res = await client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system:     SYNTH_SYSTEM,
        messages:   [{ role: "user", content: evidence.join("\n") }],
      });
      const block = res.content.find(c => c.type === "text") as Anthropic.TextBlock | undefined;
      const text  = (block?.text ?? "[]").trim();
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(match ? match[0] : "[]");
      if (Array.isArray(parsed)) {
        candidates = parsed.filter((f): f is string => typeof f === "string" && f.length > 10 && f.length < 400);
      }
    } catch {
      continue;
    }

    // Dedup against existing learned preferences
    for (const c of candidates) {
      const lc = c.toLowerCase();
      const isDupe = existingLearned.some(e =>
        e.includes(lc) || lc.includes(e) || wordOverlapRatio(lc, e) >= 0.7
      );
      if (!isDupe) {
        allNewPrefs.push({ type, content: c });
        existingLearned.push(lc);  // prevent intra-batch dupes
        perTypeStats[type].learned++;
      }
    }
  }

  if (allNewPrefs.length === 0) {
    return NextResponse.json({ learned: 0, reason: "no new preferences", stats: perTypeStats });
  }

  // Insert as learned preferences
  const rows = allNewPrefs.map(p => ({
    content: p.content,
    tags:    ["learned_preference", p.type],
  }));
  const { error: insErr } = await supabase.from("memories").insert(rows);
  if (insErr) {
    return NextResponse.json({ learned: 0, reason: insErr.message }, { status: 200 });
  }

  // Log to activity feed → surfaces in Settings → Behind the Scenes
  await supabase.from("activity_log").insert({
    type: "feedback_rollup",
    description: `Learned ${allNewPrefs.length} new preference${allNewPrefs.length === 1 ? "" : "s"} from recent feedback.`,
    detail: { preferences: allNewPrefs, stats: perTypeStats },
  }).then(() => {}, () => {});

  return NextResponse.json({
    learned: allNewPrefs.length,
    preferences: allNewPrefs,
    stats: perTypeStats,
  });
}

/** Extract a short hint from metadata (e.g., article source + tag for feed_top3). */
function summarizeMetadata(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof meta.source === "string") parts.push(String(meta.source).slice(0, 30));
  if (typeof meta.tag === "string")    parts.push(String(meta.tag).slice(0, 20));
  if (typeof meta.title === "string" && parts.length === 0) parts.push(String(meta.title).slice(0, 40));
  return parts.join(" · ");
}

/** Jaccard-ish overlap on word tokens, ignoring short noise words. */
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
