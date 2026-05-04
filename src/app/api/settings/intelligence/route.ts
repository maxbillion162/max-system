import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  let style = "";
  try {
    const { data } = await supabase.from("writing_style").select("*").limit(1);
    if (data?.[0]) {
      const row = data[0] as Record<string, unknown>;
      style = Object.entries(row)
        .filter(([k]) => k !== "id" && k !== "created_at" && k !== "updated_at")
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join("\n");
    }
  } catch {}
  let memCount = 0;
  try {
    const { count } = await supabase.from("memories").select("id", { count: "exact", head: true });
    memCount = count ?? 0;
  } catch {}
  return NextResponse.json({ style, memCount });
}
