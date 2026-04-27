import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Financial Reports — Quarterly auto-narrative generator + reader.
 *
 * GET                          — most-recent report (or all if ?all=1)
 * POST { quarter?, year? }     — generate a fresh report for the named period.
 *                                Defaults to "the previous full quarter."
 *                                The cron at /api/cron/quarterly-narrative hits
 *                                this with no body to produce the report on
 *                                the 1st of Apr/Jul/Oct/Jan.
 * PATCH { id, viewed_at? }     — mark a report as read
 *
 * Math is deterministic (income, spend, top categories, goal progress);
 * Claude only writes the prose narrative + 3-6 highlight bullets.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface Highlight { kind: "win" | "leak" | "driver" | string; text: string; value?: string }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const all = url.searchParams.get("all");
  const supabase = sb();
  let q = supabase.from("financial_reports").select("*").order("period_start", { ascending: false });
  if (!all) q = q.limit(1);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json() as { id?: string; viewed_at?: string };
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const supabase = sb();
    const { data, error } = await supabase
      .from("financial_reports")
      .update({ viewed_at: body.viewed_at ?? new Date().toISOString() })
      .eq("id", body.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ report: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { quarter?: 1 | 2 | 3 | 4; year?: number } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  return generate(body);
}

/* ────────────── Quarter math ────────────── */
function quarterRange(year: number, q: 1 | 2 | 3 | 4): { start: string; end: string; label: string } {
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end   = new Date(year, startMonth + 3, 0);   // last day of last month in quarter
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return { start: iso(start), end: iso(end), label: `Q${q} ${year}` };
}

function previousFullQuarter(now = new Date()): { quarter: 1|2|3|4; year: number } {
  const m = now.getMonth();
  /* Months 0,1,2 = Q1; 3,4,5 = Q2; etc. The "previous" is whichever quarter ENDED before today. */
  const currentQ = Math.floor(m / 3) + 1;
  if (currentQ === 1) return { quarter: 4, year: now.getFullYear() - 1 };
  return { quarter: (currentQ - 1) as 1|2|3|4, year: now.getFullYear() };
}

async function generate(opts: { quarter?: 1|2|3|4; year?: number }) {
  try {
    const supabase = sb();
    const { quarter, year } = opts.quarter && opts.year
      ? { quarter: opts.quarter, year: opts.year }
      : previousFullQuarter();

    const { start, end, label } = quarterRange(year, quarter);

    /* 1. Transactions in the period */
    const { data: txs } = await supabase
      .from("transactions")
      .select("date,amount,merchant,category,budget_category,pending")
      .gte("date", start).lte("date", end);

    const real = (txs ?? []).filter(t => !t.pending);
    const outflows = real.filter(t => t.amount > 0);
    const inflows  = real.filter(t => t.amount < 0);
    const totalSpent  = outflows.reduce((s, t) => s + t.amount, 0);
    const totalIncome = inflows.reduce((s, t) => s + Math.abs(t.amount), 0);
    const net         = totalIncome - totalSpent;
    const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0;

    /* 2. Top categories */
    const byCat: Record<string, number> = {};
    for (const t of outflows) {
      const c = t.budget_category ?? t.category ?? "Misc";
      byCat[c] = (byCat[c] ?? 0) + t.amount;
    }
    const topCats = Object.entries(byCat).sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([cat, amt]) => ({ cat, amt: Math.round(amt) }));

    /* 3. Wealth delta */
    const { data: wh } = await supabase
      .from("wealth_history")
      .select("recorded_at,net_worth")
      .gte("recorded_at", start)
      .lte("recorded_at", end + "T23:59:59")
      .order("recorded_at", { ascending: true });

    const wStart = wh?.[0]?.net_worth ?? 0;
    const wEnd   = wh?.[wh.length - 1]?.net_worth ?? 0;
    const wDelta = wEnd - wStart;

    /* 4. Goal progress */
    const { data: goals } = await supabase
      .from("goals")
      .select("label,target,current,deadline,unit");
    const goalLines = (goals ?? []).map(g => {
      const pct = g.target ? Math.round((Number(g.current) / Number(g.target)) * 100) : 0;
      return `· ${g.label}: ${g.current}/${g.target} ${g.unit ?? ""} (${pct}%)`;
    });

    /* 5. Claude prose */
    const prompt = [
      `You are M.A.X., Max's autonomous CFO. Write a Q-end narrative for the period.`,
      `Tone: dry, direct, observational, like a sharp investor letter. 4-6 paragraphs max.`,
      `Lead with the headline number. Reference specific categories/merchants. No fluff or platitudes.`,
      ``,
      `MAX: 22, Orlando, just graduated FSU, starts Account Manager job July 2026 ($100K target year-1).`,
      `Goal: $10K emergency fund. Holds BTC + XRP + Roth IRA (MDDVX/RPEAX/PTTRX).`,
      ``,
      `PERIOD: ${label} (${start} → ${end})`,
      `INCOME:        $${Math.round(totalIncome).toLocaleString()}`,
      `SPEND:         $${Math.round(totalSpent).toLocaleString()}`,
      `NET:           $${Math.round(net).toLocaleString()} (savings rate ${savingsRate.toFixed(0)}%)`,
      `NET WORTH:     $${Math.round(wStart).toLocaleString()} → $${Math.round(wEnd).toLocaleString()} (Δ ${wDelta>=0?"+":""}$${Math.round(wDelta).toLocaleString()})`,
      ``,
      `TOP CATEGORIES:`,
      topCats.map(c => `  · ${c.cat}: $${c.amt.toLocaleString()}`).join("\n"),
      ``,
      `GOAL PROGRESS:`,
      (goalLines.length ? goalLines.join("\n") : "  (no goals tracked)"),
      ``,
      `Return JSON only:`,
      `{ "narrative": "...4-6 paragraph prose...", "highlights": [{"kind":"win|leak|driver","text":"...","value":"$..."}, ...3-6 of these...] }`,
    ].join("\n");

    let narrative = "";
    let highlights: Highlight[] = [];
    try {
      const r = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }],
      });
      const text = r.content[0]?.type === "text" ? r.content[0].text : "";
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]) as { narrative: string; highlights: Highlight[] };
        narrative = parsed.narrative ?? "";
        highlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];
      }
    } catch {
      narrative = "";
    }

    if (!narrative) {
      return NextResponse.json({ error: "Claude returned no narrative" }, { status: 500 });
    }

    /* 6. Upsert (the unique index is on (period_type, period_start) so re-runs replace) */
    const { data: row, error } = await supabase
      .from("financial_reports")
      .upsert({
        period_label: label,
        period_type:  "quarterly",
        period_start: start,
        period_end:   end,
        content:      narrative,
        highlights,
        generated_at: new Date().toISOString(),
      }, { onConflict: "period_type,period_start" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ report: row });
  } catch (err) {
    console.error("reports error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
