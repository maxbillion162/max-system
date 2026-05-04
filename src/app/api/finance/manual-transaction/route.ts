import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Manual Transaction — for cash spends Plaid can't see.
 *
 * POST { date, amount, merchant, category, note? }
 *   Inserts a transactions row with source='manual' and a synthetic
 *   plaid_transaction_id of `manual:<uuid>`. Positive amount = outflow
 *   (matches the Plaid sign convention used everywhere else).
 *
 * DELETE ?id=…  removes a manual txn (won't delete Plaid-sourced rows).
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      date?:     string;
      amount?:   number;
      merchant?: string;
      category?: string;
      note?:     string;
    };

    const amount = Number(body.amount);
    if (!body.date || !body.merchant?.trim() || !Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: "date, merchant, and non-zero amount required" }, { status: 400 });
    }

    const supabase = sb();
    const id = `manual:${crypto.randomUUID()}`;
    const merchant = body.merchant.trim();

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        plaid_transaction_id: id,
        date:                 body.date,
        amount,
        merchant,
        merchant_normalized:  merchant.toLowerCase(),
        category:             body.category ?? "Misc",
        budget_category:      body.category ?? "Misc",
        source:               "manual",
        pending:              false,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transaction: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = sb();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("plaid_transaction_id", id)
    .eq("source", "manual");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
