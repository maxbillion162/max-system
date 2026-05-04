import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export async function POST(request: Request) {
  const { content, tags } = await request.json() as { content: string; tags?: string[] };
  if (!content?.trim()) return NextResponse.json({ ok: false }, { status: 400 });

  const { error } = await supabase.from("memories").insert({
    content: content.trim(),
    tags:    tags ?? [],
  });

  return NextResponse.json({ ok: !error });
}
