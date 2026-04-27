import { NextResponse } from "next/server";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedClient } from "@/lib/google";

/**
 * Writing-style fingerprint. Reads ~30 of Max's recent sent emails, asks
 * Claude to extract a structured voice profile, stores it in
 * settings.writing_style_profile so future drafts and replies can match it.
 *
 * GET   — current profile
 * POST  — recompute (samples sent folder, runs Claude, upserts settings row)
 *
 * Stored in the `settings` key/value table under key='writing_style_profile'
 * to avoid a one-row table just for this. Reuses the same approach as
 * notification_prefs / spotify_tokens.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function decodeB64(s: string) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
}): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeB64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part as Parameters<typeof extractBody>[0]);
      if (text) return text;
    }
  }
  return "";
}

function stripQuoted(text: string): string {
  /* Remove quoted reply blocks ("On … wrote:" + lines starting with >) */
  const lines = text.split("\n");
  const out: string[] = [];
  for (const l of lines) {
    if (/^On .* wrote:/.test(l.trim())) break;
    if (/^-{2,} ?Original Message ?-{2,}/.test(l.trim())) break;
    if (l.trim().startsWith(">")) continue;
    out.push(l);
  }
  return out.join("\n").trim();
}

interface VoiceProfile {
  greeting_examples:    string[];   // "Hey", "Hi —", "Yo"
  signoff_examples:     string[];   // "Cheers", "Thanks", "—Max"
  sentence_length:      "short" | "medium" | "long";
  formality:            "casual" | "neutral" | "professional";
  signature_phrases:    string[];   // recurring phrases
  punctuation_quirks:   string[];   // "uses em-dashes liberally", "double-breaks paragraphs"
  voice_summary:        string;     // 2-3 sentence prose summary
  sample_count:         number;
  generated_at:         string;
}

export async function GET() {
  const supabase = sb();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "writing_style_profile")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: (data?.value as VoiceProfile | null) ?? null });
}

export async function POST() {
  try {
    const auth = await getAuthenticatedClient();
    if (!auth) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

    const supabase = sb();
    const gmail = google.gmail({ version: "v1", auth });

    /* Pull a wider net to filter out short replies / noisy auto-mail */
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "in:sent -from:noreply -from:no-reply",
      maxResults: 60,
    });

    const messages = list.data.messages ?? [];
    if (messages.length === 0) {
      return NextResponse.json({ error: "No sent emails found" }, { status: 400 });
    }

    /* Fetch bodies */
    const samples: string[] = [];
    for (const m of messages) {
      try {
        const detail = await gmail.users.messages.get({ userId: "me", id: m.id!, format: "full" });
        const text = stripQuoted(extractBody(detail.data.payload as Parameters<typeof extractBody>[0]));
        const trimmed = text.trim();
        if (trimmed.length >= 80 && trimmed.length <= 1500) {
          samples.push(trimmed);
        }
        if (samples.length >= 30) break;
      } catch { /* skip bad messages */ }
    }

    if (samples.length < 5) {
      return NextResponse.json({ error: `Only ${samples.length} usable samples — need 5+ substantive sent emails.` }, { status: 400 });
    }

    /* Claude extracts the profile */
    const prompt = [
      `You are analyzing email writing samples to build a voice fingerprint. The author is Max — 22, just graduated FSU, starts an Account Manager job July 2026.`,
      ``,
      `Read all ${samples.length} sample emails below and extract a structured voice profile. Be SPECIFIC, not generic. The fingerprint will be used by an AI to draft replies in Max's voice — generic descriptions are useless.`,
      ``,
      `Return JSON only:`,
      `{`,
      `  "greeting_examples":  ["..." up to 5],`,
      `  "signoff_examples":   ["..." up to 5],`,
      `  "sentence_length":    "short" | "medium" | "long",`,
      `  "formality":          "casual" | "neutral" | "professional",`,
      `  "signature_phrases":  ["..." up to 8 — phrases or words Max uses repeatedly],`,
      `  "punctuation_quirks": ["..." up to 5 — observable patterns, not guesses],`,
      `  "voice_summary":      "2-3 sentence prose describing how Max writes"`,
      `}`,
      ``,
      `── SAMPLES ──`,
      samples.map((s, i) => `[${i+1}]\n${s}`).join("\n\n──\n\n"),
    ].join("\n");

    const r = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = r.content[0]?.type === "text" ? r.content[0].text : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "Claude returned no profile" }, { status: 500 });

    const parsed = JSON.parse(m[0]) as Omit<VoiceProfile, "sample_count" | "generated_at">;
    const profile: VoiceProfile = {
      ...parsed,
      sample_count: samples.length,
      generated_at: new Date().toISOString(),
    };

    /* Upsert into settings k/v */
    const { error: upsertErr } = await supabase
      .from("settings")
      .upsert({ key: "writing_style_profile", value: profile }, { onConflict: "key" });
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("writing-style error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
