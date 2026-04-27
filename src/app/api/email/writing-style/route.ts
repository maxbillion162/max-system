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
  greeting_examples:    string[];
  signoff_examples:     string[];
  sentence_length:      string;
  formality:            string;
  signature_phrases:    string[];
  punctuation_quirks:   string[];
  structural_habits?:   string[];
  register_shifts?:     string[];
  voice_summary:        string;
  do_list?:             string[];
  dont_list?:           string[];
  sample_count:         number;
  scanned_count?:       number;
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

    /* Pull a much wider net — paginate through up to 500 sent messages */
    const SENT_QUERY = "in:sent -from:noreply -from:no-reply -from:mailer-daemon";
    const SAMPLE_TARGET = 120;          // up from 30 — deeper signal
    const FETCH_CAP     = 500;          // Gmail messages to consider
    const PER_PAGE      = 100;

    const messageIds: { id: string }[] = [];
    let pageToken: string | undefined = undefined;
    while (messageIds.length < FETCH_CAP) {
      const params: { userId: string; q: string; maxResults: number; pageToken?: string } = {
        userId: "me",
        q: SENT_QUERY,
        maxResults: PER_PAGE,
      };
      if (pageToken) params.pageToken = pageToken;
      const list = await gmail.users.messages.list(params);
      const batch: Array<{ id?: string | null }> = list.data.messages ?? [];
      for (const msg of batch) {
        if (typeof msg.id === "string") messageIds.push({ id: msg.id });
      }
      const next: string | null | undefined = list.data.nextPageToken;
      if (!next || batch.length === 0) break;
      pageToken = next;
    }

    if (messageIds.length === 0) {
      return NextResponse.json({ error: "No sent emails found" }, { status: 400 });
    }

    /* Fetch bodies in parallel batches of 10 — way faster than serial */
    const samples: string[] = [];
    const BATCH = 10;
    let scanned = 0;
    for (let i = 0; i < messageIds.length && samples.length < SAMPLE_TARGET; i += BATCH) {
      const slice = messageIds.slice(i, i + BATCH);
      const bodies = await Promise.all(slice.map(async ({ id }) => {
        try {
          const detail = await gmail.users.messages.get({ userId: "me", id, format: "full" });
          return stripQuoted(extractBody(detail.data.payload as Parameters<typeof extractBody>[0])).trim();
        } catch {
          return "";
        }
      }));
      scanned += slice.length;
      for (const text of bodies) {
        if (samples.length >= SAMPLE_TARGET) break;
        /* Quality filter: substantive length, not just iPhone footer / OOO / auto-reply */
        if (text.length < 60 || text.length > 4000) continue;
        const lower = text.toLowerCase();
        if (lower.startsWith("sent from my iphone") && text.length < 200) continue;
        if (/^(out of office|i am out of|automatic reply|auto-reply)/i.test(text)) continue;
        if (/unsubscribe/i.test(text) && text.length < 300) continue;
        samples.push(text);
      }
    }

    if (samples.length < 5) {
      return NextResponse.json({
        error: `Only ${samples.length} usable samples after scanning ${scanned} sent emails — need 5+ substantive ones.`,
      }, { status: 400 });
    }

    /* Claude extracts the profile — richer schema, more depth */
    const prompt = [
      `You are a forensic linguist analyzing ${samples.length} of Max's sent emails to build a HIGH-FIDELITY voice fingerprint that an AI will use to draft replies on his behalf.`,
      ``,
      `Max is 22, just graduated FSU, starts an Account Manager job July 2026. He likely writes in different registers — work/professional, customer-service complaints, personal/casual, transactional.`,
      ``,
      `Read EVERY sample. Be SPECIFIC, EVIDENCE-BASED, and SHARP. Generic platitudes ("uses polite language", "is professional") are useless and disqualifying. Cite actual phrases and patterns. Note when he code-switches between contexts.`,
      ``,
      `Return JSON only with this expanded schema:`,
      `{`,
      `  "greeting_examples":      ["..." up to 8 — actual openings that recur, not paraphrased],`,
      `  "signoff_examples":       ["..." up to 8],`,
      `  "sentence_length":        "short" | "medium" | "long" | "varies",`,
      `  "formality":              "casual" | "neutral" | "professional" | "varies-by-context",`,
      `  "signature_phrases":      ["..." up to 12 — recurring phrases or mini-expressions, exact wording],`,
      `  "punctuation_quirks":     ["..." up to 8 — observable patterns with examples],`,
      `  "structural_habits":      ["..." up to 6 — paragraphing, list use, attachments, opening pattern, etc.],`,
      `  "register_shifts":        ["..." up to 4 — when/how Max changes register. e.g. 'signs as Maximillian for institutional, Max for casual'. Empty array if no clear pattern.],`,
      `  "voice_summary":          "3-4 sentence prose describing how Max writes — reads like a coach briefing a stand-in writer",`,
      `  "do_list":                ["..." up to 5 — concrete things to ALWAYS do when drafting in his voice],`,
      `  "dont_list":              ["..." up to 5 — concrete things to NEVER do]`,
      `}`,
      ``,
      `── SAMPLES (${samples.length}) ──`,
      samples.map((s, i) => `[${i+1}]\n${s}`).join("\n\n──\n\n"),
    ].join("\n");

    const r = await anthropic.messages.create({
      model: "claude-sonnet-4-6",      // upgrade from Haiku — deeper reading on the foundational profile is worth it
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = r.content[0]?.type === "text" ? r.content[0].text : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "Claude returned no profile" }, { status: 500 });

    const parsed = JSON.parse(m[0]) as Omit<VoiceProfile, "sample_count" | "generated_at" | "scanned_count">;
    const profile: VoiceProfile = {
      ...parsed,
      sample_count:  samples.length,
      scanned_count: scanned,
      generated_at:  new Date().toISOString(),
    };
    /* Deployment marker so we can tell new code is live */
    (profile as VoiceProfile & { version: string }).version = "v2-sonnet-120";

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
