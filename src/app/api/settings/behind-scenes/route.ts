import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const [actRes, memRes, notifRes] = await Promise.allSettled([
    supabase.from("activity_log").select("id,type,description,created_at").order("created_at", { ascending: false }).limit(15),
    supabase.from("memories").select("id,content,tags,created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("notifications").select("id,type,title,body,read,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  return NextResponse.json({
    activity: actRes.status === "fulfilled" ? actRes.value.data ?? [] : [],
    memories: memRes.status === "fulfilled" ? memRes.value.data ?? [] : [],
    notifications: notifRes.status === "fulfilled" ? notifRes.value.data ?? [] : [],
  });
}
