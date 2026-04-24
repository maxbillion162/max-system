import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOptedIn, notify } from "@/lib/notify";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  // OPT-IN: skip expensive data work unless user enabled the category
  if (!(await isOptedIn("bill_alerts"))) return NextResponse.json({ alerted: 0, reason: "not opted in" });

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
      const suffix = bill.due===1?"st":bill.due===2?"nd":bill.due===3?"rd":"th";
      await notify({
        category: "bill_alerts",
        title:    `${bill.name} due in 3 days`,
        body:     `$${bill.amt.toFixed(2)} due on the ${bill.due}${suffix}.`,
        telegramText: `⚠️ *Bill Due in 3 Days*\n\n*${bill.name}* — $${bill.amt.toFixed(2)}\nDue on the ${bill.due}${suffix} of this month.`,
      });
      alerted.push(bill.name);
    }
  }

  return NextResponse.json({ alerted, count: alerted.length });
}
