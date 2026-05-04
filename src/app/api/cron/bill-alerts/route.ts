import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isOptedIn, notify } from "@/lib/notify";
import { requireCron } from "@/lib/auth-guards";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const guard = requireCron(req); if (guard) return guard;
  // OPT-IN: skip expensive data work unless user enabled the category
  if (!(await isOptedIn("bill_alerts"))) return NextResponse.json({ alerted: 0, reason: "not opted in" });

  const { data: bills } = await supabase
    .from("bills")
    .select("name,amt,due,active,recurrence,next_due_date");
  if (!bills || bills.length === 0) return NextResponse.json({ alerted: 0 });

  const today = new Date();
  const dayOfMonth = today.getDate();
  const alerted: string[] = [];

  type Row = {
    name: string; amt: number; due: number;
    active?: boolean | null;
    recurrence?: string | null;
    next_due_date?: string | null;
  };

  for (const bill of bills as Row[]) {
    if (bill.active === false) continue;

    /* Non-monthly bills use next_due_date directly */
    let daysUntil: number;
    if (bill.next_due_date && bill.recurrence && bill.recurrence !== "monthly") {
      const target = new Date(bill.next_due_date + "T12:00:00");
      const ms = target.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime();
      daysUntil = Math.round(ms / 86_400_000);
      if (daysUntil < 0) continue;
    } else {
      daysUntil = bill.due >= dayOfMonth ? bill.due - dayOfMonth : bill.due + 31 - dayOfMonth;
    }

    if (daysUntil !== 3 && daysUntil !== 7) continue;

    const suffix = bill.due===1?"st":bill.due===2?"nd":bill.due===3?"rd":"th";
    const window = daysUntil === 7 ? "7 days" : "3 days";
    const dueLabel = bill.next_due_date && bill.recurrence !== "monthly"
      ? new Date(bill.next_due_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : `the ${bill.due}${suffix}`;

    await notify({
      category: "bill_alerts",
      title:    `${bill.name} due in ${window}`,
      body:     `$${bill.amt.toFixed(2)} due ${dueLabel}.`,
      telegramText: `${daysUntil === 7 ? "📅" : "⚠️"} *Bill Due in ${window}*\n\n*${bill.name}* — $${bill.amt.toFixed(2)}\nDue ${dueLabel}.`,
    });
    alerted.push(`${bill.name}(${window})`);
  }

  return NextResponse.json({ alerted, count: alerted.length });
}
