// ONE-TIME ADMIN ROUTE — DELETE THIS FILE AFTER RUNNING
// POST /api/admin/memory-reset with body { secret: "max-reset-2026" }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";

const SECRET = "max-reset-2026";

const GROUND_TRUTH_MEMORIES = [
  {
    content: "Max Khomutetsky, 22 years old, FSU grad (Commercial Entrepreneurship, spring 2026), based in Orlando FL. Starting as Associate Account Manager at Dexian on Monday, July 13, 2026. Base salary $60K/year (~$3,462/mo net). Commission structure: realtor model (TBD). First paycheck expected around July 27, 2026.",
    tags: ["identity", "employment", "dexian", "income"],
  },
  {
    content: "Living situation: Currently at mom's house in Orlando, rent-free for one year. Two more months of Tallahassee apartment rent ($900/mo = $1,800 total remaining through July 2026). $5,000 student loan to pay off — no monthly obligation yet.",
    tags: ["living", "rent", "finances", "housing"],
  },
  {
    content: "Current finances as of July 10, 2026: Received $5,000 graduation gift from dad. Spent ~$1,000 (Tallahassee visit with girlfriend, meals, gas). ~$4,000 liquid remaining. No income since DoubleTree job ended end of spring semester. Burn rate higher than normal this week visiting girlfriend in Tallahassee — drops significantly once employed.",
    tags: ["finances", "cash", "spending", "liquid"],
  },
  {
    content: "Net worth snapshot (July 2026): ~$4,188 total. Small liquid cash after recent spending, ~$2,720 IRA at Schwab (funds: MDDVX, RPEAX, PTTRX), small crypto holdings (BTC + XRP on Robinhood). Emergency fund goal: $10K (28% there). No significant debt obligations yet beyond student loan.",
    tags: ["net-worth", "wealth", "ira", "crypto"],
  },
  {
    content: "Max's three active goals: (1) Emergency Fund $10K — 28% complete, due Dec 1, 2026. (2) Gym 4×/Week full year — 23% complete, due Apr 1, 2027. (3) First-year income $100K — 0% complete, due July 1, 2027.",
    tags: ["goals", "emergency-fund", "gym", "income"],
  },
  {
    content: "Feed preferences: Crypto news OK in Top 3 feed but max 1 per day. Wants diversified feed across topics. No Bitcoin dominance articles. Prefers actionable finance/business/entrepreneurship content.",
    tags: ["feed", "preferences", "crypto", "news", "learned_preference"],
  },
  {
    content: "Max is not a developer. He built M.A.X. using Claude Code (CLI) as his engineering tool. Understands concepts, can run terminal commands when given exact instructions, cannot write code himself. Explain things in 1-2 plain English sentences — no jargon without a brief explanation.",
    tags: ["identity", "developer", "context", "communication", "learned_preference"],
  },
  {
    content: "M.A.X. personality standard: Sharp EA meets quiet quant. Calm, direct, warm without being soft. Occasionally dry. Proactive — sees what Max can't, takes action rather than describing options. Ruthless concision. Adult-to-adult: inform, he decides. Never nag or moralize. Never open with 'Great question,' 'Of course,' 'Certainly,' 'Absolutely,' or 'Happy to help.' No preamble. Start with answer or action. Specific numbers always. Bold sparingly. Consistent across web, Telegram, and floating chat.",
    tags: ["personality", "voice", "behavior", "learned_preference"],
  },
  {
    content: "Max has a girlfriend. Was visiting her in Tallahassee week of July 7, 2026. Gym 3-5x/week (push/pull/legs split). Night owl working on building a morning routine. Into sales, AI, entrepreneurship, and investing.",
    tags: ["identity", "lifestyle", "girlfriend", "gym"],
  },
  {
    content: "M.A.X. dashboard surfaces: main chat, news/feed page, discipline page (tasks + habits), unified dashboard with net worth / habits / tasks / crypto / weather / intel feed. Personal CRM planned for later. All interconnected — agent can read and act across all of them.",
    tags: ["product", "dashboard", "surfaces", "architecture"],
  },
];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.secret !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all existing memory IDs
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("memories")
    .select("id");

  if (fetchErr) {
    return NextResponse.json({ error: "Fetch failed: " + fetchErr.message }, { status: 500 });
  }

  const ids = (existing ?? []).map((r: { id: string }) => r.id);
  let deleted = 0;

  // Delete all existing memories
  if (ids.length > 0) {
    const { error: delErr } = await supabaseAdmin
      .from("memories")
      .delete()
      .in("id", ids);
    if (delErr) {
      return NextResponse.json({ error: "Delete failed: " + delErr.message }, { status: 500 });
    }
    deleted = ids.length;
  }

  // Insert encrypted ground-truth memories
  const errors: string[] = [];
  let inserted = 0;

  for (const mem of GROUND_TRUTH_MEMORIES) {
    const { error: insertErr } = await supabaseAdmin.from("memories").insert({
      content: encrypt(mem.content),
      tags: mem.tags,
    });
    if (insertErr) {
      errors.push(insertErr.message);
    } else {
      inserted++;
    }
  }

  return NextResponse.json({
    deleted,
    inserted,
    errors: errors.length > 0 ? errors : undefined,
    ok: errors.length === 0,
  });
}
