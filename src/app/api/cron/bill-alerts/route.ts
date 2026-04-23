import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendNotification } from "@/app/api/telegram/route";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  // Check notification prefs
  const { data: prefRow } = await supabase.from("settings").select("value").eq("key", "notification_prefs").single();
  const prefs = (prefRow?.value ?? {}) as { bill_alerts?: boolean };
  if (prefs.bill_alerts === false) return NextResponse.json({ alerted: 0, reason: "disabled in settings" });

  const { data: bills } = await supabase.from("bills").select("name,amt,due");
  if (!bills || bills.length === 0) return NextResponse.json({ alerted: 0 });

  const today = new Date();
  const dayOfMonth = today.getDate();
  const alerted: string[] = [];

  for (const bill of bills as { name: string; amt: number; due: number }[]) {
    const daysUntil = bill.due >= dayOfMonth
      ? bill.due - dayOfMonth
      : bill.due + 31 - dayOfMonth;

    if (daysUntil === 3) {
      const msg = `⚠️ *Bill Due in 3 Days*\n\n*${bill.name}* — $${bill.amt.toFixed(2)}\nDue on the ${bill.due}${bill.due===1?"st":bill.due===2?"nd":bill.due===3?"rd":"th"} of this month.`;
      await sendNotification(msg);

      await supabase.from("notifications").insert({
        type: "bill_due",
        title: `${bill.name} due in 3 days`,
        body: `$${bill.amt.toFixed(2)} due on the ${bill.due}th`,
        read: false,
      });

      alerted.push(bill.name);
    }
  }

  return NextResponse.json({ alerted, count: alerted.length });
}
