import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { decrypt } from "@/lib/encryption";

export async function GET() {
  const [actRes, memRes, notifRes] = await Promise.allSettled([
    supabase.from("activity_log").select("id,type,description,created_at").order("created_at", { ascending: false }).limit(15),
    supabase.from("memories").select("id,content,tags,created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("notifications").select("id,type,title,body,read,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const memories = (memRes.status === "fulfilled" ? memRes.value.data ?? [] : [])
    .map(m => ({ ...m, content: decrypt(m.content) ?? "" }));
  return NextResponse.json({
    activity: actRes.status === "fulfilled" ? actRes.value.data ?? [] : [],
    memories,
    notifications: notifRes.status === "fulfilled" ? notifRes.value.data ?? [] : [],
  });
}
