import { NextResponse } from "next/server";
import { sb } from "@/lib/email-intel";

/**
 * Email rules — full CRUD for the rules engine.
 *
 * GET                              — list all rules
 * POST   { name, condition_type, condition_value, action_classification, priority?, source? }
 * PATCH  { id, ...patch }          — toggle active, edit value, etc.
 * DELETE ?id=…                     — remove
 */

export async function GET() {
  const supabase = sb();
  const { data, error } = await supabase
    .from("email_rules")
    .select("*")
    .order("priority", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name || !body.condition_type || !body.condition_value || !body.action_classification) {
      return NextResponse.json({ error: "name + condition_type + condition_value + action_classification required" }, { status: 400 });
    }

    const supabase = sb();
    const { data, error } = await supabase
      .from("email_rules")
      .insert({
        name:                  body.name,
        condition_type:        body.condition_type,
        condition_value:       body.condition_value,
        action_classification: body.action_classification,
        priority:              body.priority ?? 50,
        active:                body.active ?? true,
        source:                body.source ?? "manual",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rule: data });
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
      .from("email_rules")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rule: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = sb();
  const { error } = await supabase.from("email_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
