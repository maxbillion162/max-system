import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Investment Thesis — per-holding written conviction Max can refer back to.
 *
 * GET                                 — all active theses
 * GET ?holding_id=BTC                 — thesis for one holding
 * POST  { holding_id, holding_type, thesis, conviction? }
 * PATCH { id, thesis?, conviction?, active?, last_referenced_at? }
 * DELETE ?id=…                        — remove
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const holding = url.searchParams.get("holding_id");
  const supabase = sb();
  let q = supabase.from("investment_thesis").select("*").eq("active", true).order("written_at", { ascending: false });
  if (holding) q = q.eq("holding_id", holding);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ theses: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      holding_id?:   string;
      holding_type?: "crypto" | "fund" | "stock" | "etf" | "other";
      thesis?:       string;
      conviction?:   number;
    };
    if (!body.holding_id || !body.holding_type || !body.thesis?.trim()) {
      return NextResponse.json({ error: "holding_id + holding_type + thesis required" }, { status: 400 });
    }

    const supabase = sb();
    /* Retire any prior active thesis on this holding so newest is the canonical one */
    await supabase
      .from("investment_thesis")
      .update({ active: false })
      .eq("holding_id", body.holding_id)
      .eq("active", true);

    const { data, error } = await supabase
      .from("investment_thesis")
      .insert({
        holding_id:   body.holding_id,
        holding_type: body.holding_type,
        thesis:       body.thesis.trim(),
        conviction:   body.conviction ?? null,
        active:       true,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ thesis: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json() as { id?: string } & Record<string, unknown>;
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { id, ...patch } = body;
    const supabase = sb();
    const { data, error } = await supabase
      .from("investment_thesis")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ thesis: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = sb();
  const { error } = await supabase.from("investment_thesis").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
