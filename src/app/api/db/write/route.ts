/**
 * Server-only write proxy for dashboard tables.
 *
 * The browser used to write to these tables directly with the anon key.
 * That meant the (publicly visible) anon key was a vector for mass-wipe /
 * data poisoning attacks if it ever leaked. Now writes flow through this
 * cookie-gated endpoint, which uses the service role on the server.
 *
 * After RLS is also tightened to deny anon writes/deletes on these tables,
 * the public anon key becomes useless for modifying data.
 */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const ALLOWED_TABLES = new Set([
  "habits", "habit_logs",
  "tasks", "task_lists",
  "goals", "goal_notes",
  "bills",
  "settings",
]);

const ALLOWED_OPS = new Set(["insert", "update", "upsert", "delete"]);

interface WriteRequest {
  table: string;
  op: "insert" | "update" | "upsert" | "delete";
  values?: unknown;
  match?: Record<string, unknown>;
  notMatch?: Record<string, unknown>;
  onConflict?: string;
  returnSelect?: string;
  returnSingle?: boolean;
}

export async function POST(req: Request) {
  let body: WriteRequest;
  try {
    body = await req.json() as WriteRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.table || typeof body.table !== "string" || !ALLOWED_TABLES.has(body.table)) {
    return NextResponse.json({ error: "table not allowed" }, { status: 400 });
  }
  if (!body.op || !ALLOWED_OPS.has(body.op)) {
    return NextResponse.json({ error: "op not allowed" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(body.table);

  switch (body.op) {
    case "insert":
      if (body.values === undefined) return NextResponse.json({ error: "values required" }, { status: 400 });
      q = q.insert(body.values);
      break;
    case "update":
      if (body.values === undefined) return NextResponse.json({ error: "values required" }, { status: 400 });
      q = q.update(body.values);
      break;
    case "upsert":
      if (body.values === undefined) return NextResponse.json({ error: "values required" }, { status: 400 });
      q = body.onConflict ? q.upsert(body.values, { onConflict: body.onConflict }) : q.upsert(body.values);
      break;
    case "delete":
      q = q.delete();
      break;
  }

  if (body.match) {
    for (const [k, v] of Object.entries(body.match)) q = q.eq(k, v);
  }
  if (body.notMatch) {
    for (const [k, v] of Object.entries(body.notMatch)) q = q.neq(k, v);
  }

  if (body.returnSelect !== undefined) q = q.select(body.returnSelect || "*");
  if (body.returnSingle) q = q.single();

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
