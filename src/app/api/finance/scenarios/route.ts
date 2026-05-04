import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ProjectionKnobs } from "@/lib/finance-forecast";

/**
 * Scenarios — saveable what-if projections.
 *
 * GET                                 — list all (filterable by status)
 * POST   { label, knobs, baseline_data?, description?, trigger_event?, trigger_date? }
 * PATCH  { id, status?, label?, ...}  — update one
 * DELETE ?id=…                        — remove one
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const supabase = sb();
  let q = supabase.from("scenarios").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scenarios: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      label?:         string;
      description?:   string;
      knobs?:         ProjectionKnobs;
      baseline_data?: unknown;
      trigger_event?: string;
      trigger_date?:  string;
    };
    if (!body.label || !body.knobs) {
      return NextResponse.json({ error: "label + knobs required" }, { status: 400 });
    }

    const supabase = sb();
    const { data, error } = await supabase
      .from("scenarios")
      .insert({
        label:         body.label,
        description:   body.description ?? null,
        knobs:         body.knobs,
        baseline_data: body.baseline_data ?? null,
        trigger_event: body.trigger_event ?? null,
        trigger_date:  body.trigger_date  ?? null,
        status:        "active",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ scenario: data });
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
      .from("scenarios")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ scenario: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = sb();
  const { error } = await supabase.from("scenarios").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
