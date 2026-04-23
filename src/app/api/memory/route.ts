import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const { content, tags } = await request.json() as { content: string; tags?: string[] };
  if (!content?.trim()) return NextResponse.json({ ok: false }, { status: 400 });

  const { error } = await supabase.from("memories").insert({
    content: content.trim(),
    tags:    tags ?? [],
  });

  return NextResponse.json({ ok: !error });
}
