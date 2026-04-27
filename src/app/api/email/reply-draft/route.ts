import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sb } from "@/lib/email-intel";

/**
 * Reply-draft — Claude generates a reply matching Max's voice.
 *
 * POST { thread_id, original_subject, original_from, original_body, intent? }
 *
 * Reads the current writing-style profile from settings.writing_style_profile
 * and any `learned_preference` memories tagged for emails. Returns:
 *   { draft, draft_id, voice_used }
 *
 * The UI mounts FeedbackControl on the result with artifactType='email_draft'
 * and id=draft_id so the daily rollup can teach the system over time.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface VoiceProfile {
  greeting_examples?:    string[];
  signoff_examples?:     string[];
  sentence_length?:      string;
  formality?:            string;
  signature_phrases?:    string[];
  punctuation_quirks?:   string[];
  structural_habits?:    string[];
  register_shifts?:      string[];
  voice_summary?:        string;
  do_list?:              string[];
  dont_list?:            string[];
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      thread_id?:        string;
      original_subject?: string;
      original_from?:    string;
      original_body?:    string;
      intent?:           string;
    };

    if (!body.original_subject || !body.original_from || !body.original_body) {
      return NextResponse.json({ error: "original_subject + original_from + original_body required" }, { status: 400 });
    }

    const supabase = sb();
    const [voiceRes, prefsRes] = await Promise.all([
      supabase.from("settings").select("value").eq("key", "writing_style_profile").maybeSingle(),
      supabase.from("memories").select("content").contains("tags", ["learned_preference"]).limit(20),
    ]);

    const voice = (voiceRes.data?.value as VoiceProfile | null) ?? null;
    const prefs = (prefsRes.data ?? [])
      .map(m => (m as { content: string }).content)
      .filter(c => /email|reply|draft|voice|tone|sign/i.test(c));

    const lines: string[] = [
      `You are drafting an email reply on behalf of Max — 22, just graduated FSU, starts an Account Manager job July 2026.`,
      `Match Max's voice. Don't add an "AI-generated" feel. No sycophancy. Lead with the substance.`,
      `Don't sign off as "M.A.X." or "AI" — sign as Max would (just "Max", or whatever his usual sign-off is).`,
      ``,
    ];
    if (voice?.voice_summary) {
      lines.push(`MAX'S VOICE PROFILE:`);
      lines.push(`- Summary: ${voice.voice_summary}`);
      if (voice.formality)            lines.push(`- Formality: ${voice.formality}`);
      if (voice.sentence_length)      lines.push(`- Sentence length: ${voice.sentence_length}`);
      if (voice.greeting_examples?.length) lines.push(`- Greetings used: ${voice.greeting_examples.join(" | ")}`);
      if (voice.signoff_examples?.length)  lines.push(`- Sign-offs used: ${voice.signoff_examples.join(" | ")}`);
      if (voice.signature_phrases?.length) lines.push(`- Signature phrases: ${voice.signature_phrases.join(" | ")}`);
      if (voice.punctuation_quirks?.length) lines.push(`- Punctuation quirks: ${voice.punctuation_quirks.join(" | ")}`);
      if (voice.structural_habits?.length) lines.push(`- Structural habits: ${voice.structural_habits.join(" | ")}`);
      if (voice.register_shifts?.length)   lines.push(`- Register shifts: ${voice.register_shifts.join(" | ")}`);
      if (voice.do_list?.length)           lines.push(`- ALWAYS: ${voice.do_list.join(" | ")}`);
      if (voice.dont_list?.length)         lines.push(`- NEVER:  ${voice.dont_list.join(" | ")}`);
      lines.push(``);
    } else {
      lines.push(`(No writing-style profile yet — match a casual-direct young-professional tone.)`);
      lines.push(``);
    }

    if (prefs.length > 0) {
      lines.push(`LEARNED PREFERENCES from past 👍/👎 feedback:`);
      for (const p of prefs) lines.push(`- ${p}`);
      lines.push(``);
    }

    lines.push(`ORIGINAL EMAIL:`);
    lines.push(`From: ${body.original_from}`);
    lines.push(`Subject: ${body.original_subject}`);
    lines.push(``);
    lines.push(body.original_body.slice(0, 4000));
    lines.push(``);

    if (body.intent?.trim()) {
      lines.push(`MAX'S INTENT for this reply: ${body.intent.trim()}`);
      lines.push(``);
    }

    lines.push(`Draft the reply body ONLY (no subject line, no headers). Plain text. Match Max's voice.`);

    const r = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: lines.join("\n") }],
    });
    const draft = r.content[0]?.type === "text" ? r.content[0].text.trim() : "";
    if (!draft) return NextResponse.json({ error: "Empty draft" }, { status: 500 });

    const draftId = `draft:${body.thread_id ?? "new"}:${Date.now()}`;
    return NextResponse.json({
      draft,
      draft_id:   draftId,
      voice_used: voice?.voice_summary ? true : false,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
