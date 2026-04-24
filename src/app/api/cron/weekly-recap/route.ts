import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchCryptoPrices } from "@/lib/crypto";
import { sendNotification } from "@/app/api/telegram/route";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Check notification prefs
    const { data: prefRow } = await supabase.from("settings").select("value").eq("key", "notification_prefs").single();
    const prefs = (prefRow?.value ?? {}) as { weekly_recap?: boolean };
    if (prefs.weekly_recap === false) return NextResponse.json({ ok: false, reason: "disabled in settings" });

    const [habitsRes, tasksRes, goalsRes, cryptoRes] = await Promise.allSettled([
      supabase.from("habits").select("name,completed,streak").order("streak", { ascending: false }),
      supabase.from("tasks").select("text,completed,priority,created_at"),
      supabase.from("goals").select("*"),
      fetchCryptoPrices(),
    ]);

    const habits = habitsRes.status  === "fulfilled" ? (habitsRes.value.data ?? [])  : [];
    const tasks  = tasksRes.status   === "fulfilled" ? (tasksRes.value.data ?? [])   : [];
    const goals  = goalsRes.status   === "fulfilled" ? (goalsRes.value.data ?? [])   : [];
    const crypto = cryptoRes.status  === "fulfilled" ? cryptoRes.value               : [];

    const btc = crypto.find((c: { symbol: string }) => c.symbol === "BTC");
    const xrp = crypto.find((c: { symbol: string }) => c.symbol === "XRP");

    const habitsDone  = habits.filter((h: { completed: boolean }) => h.completed).length;
    const habitsTotal = habits.length;
    const topStreak   = habits[0];

    const weekAgo     = new Date(Date.now() - 7 * 86400000).toISOString();
    const completedThisWeek = tasks.filter((t: { completed: boolean; created_at: string }) =>
      t.completed && t.created_at >= weekAgo
    ).length;
    const openTasks = tasks.filter((t: { completed: boolean }) => !t.completed).length;

    const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
    const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });

    // Telegram message
    const lines = [
      `📊 *M.A.X. Weekly Recap*`,
      `_${date}_`,
      ``,
      `*🏋️ Habits*`,
      `${habitsDone}/${habitsTotal} done today`,
      topStreak?.streak > 1 ? `🔥 Top streak: ${topStreak.name} (${topStreak.streak} days)` : "",
      ``,
      `*✅ Tasks*`,
      `${completedThisWeek} completed this week`,
      `${openTasks} still open`,
      ``,
    ];

    if (goals.length > 0) {
      lines.push("*🎯 Goals*");
      goals.slice(0, 4).forEach((g: { label?: string; id: string; current: number; target: number }) => {
        const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
        lines.push(`${g.label ?? g.id}: ${pct}%`);
      });
      lines.push("");
    }

    if (btc || xrp) {
      lines.push("*📈 Crypto*");
      if (btc) lines.push(`BTC $${Math.round(btc.price).toLocaleString()} (${fmt(btc.change24h)}% 24h)`);
      if (xrp) lines.push(`XRP $${xrp.price.toFixed(4)} (${fmt(xrp.change24h)}% 24h)`);
      lines.push("");
    }

    lines.push("_Another week in the books. Keep building._");

    const msg = lines.filter(l => l !== undefined && l !== null).join("\n");
    await sendNotification(msg);

    // Also send a simpler email version
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const S = { bg: "#04060f", card: "#040608", border: "rgba(125,184,232,0.12)", blue: "#7DB8E8", green: "#5FB07D", red: "#C85A5A", amber: "#C85A5A", t1: "#f0f9ff", t2: "#94a3b8", t3: "#475569", t4: "#1e3a5f" };
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:${S.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${S.bg};padding:40px 20px;"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
  <tr><td style="background:${S.card};border:1px solid ${S.border};border-radius:16px;padding:36px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="color:${S.blue};font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">M.A.X. · WEEKLY RECAP</div>
      <div style="color:${S.t1};font-size:24px;font-weight:900;">Week of ${date}</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:14px;background:rgba(95,176,125,0.06);border:1px solid rgba(95,176,125,0.12);border-radius:8px;text-align:center;">
          <div style="color:${S.green};font-size:28px;font-weight:900;">${habitsDone}/${habitsTotal}</div>
          <div style="color:${S.t3};font-size:11px;margin-top:3px;">Habits today</div>
        </td>
        <td style="width:12px;"></td>
        <td style="padding:14px;background:rgba(125,184,232,0.06);border:1px solid rgba(125,184,232,0.12);border-radius:8px;text-align:center;">
          <div style="color:${S.blue};font-size:28px;font-weight:900;">${completedThisWeek}</div>
          <div style="color:${S.t3};font-size:11px;margin-top:3px;">Tasks done</div>
        </td>
        <td style="width:12px;"></td>
        <td style="padding:14px;background:rgba(200,90,90,0.06);border:1px solid rgba(200,90,90,0.12);border-radius:8px;text-align:center;">
          <div style="color:${S.amber};font-size:28px;font-weight:900;">${topStreak?.streak ?? 0}</div>
          <div style="color:${S.t3};font-size:11px;margin-top:3px;">Top streak</div>
        </td>
      </tr>
    </table>
    ${btc || xrp ? `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(125,184,232,0.08);">
      <div style="color:${S.t3};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">📈 Crypto</div>
      ${btc ? `<div style="color:${S.t2};font-size:13px;margin-bottom:4px;">BTC <span style="color:${S.t1};font-weight:700;font-family:monospace;">$${Math.round(btc.price).toLocaleString()}</span> <span style="color:${btc.change24h >= 0 ? S.green : S.red};">${fmt(btc.change24h)}% 24h</span></div>` : ""}
      ${xrp ? `<div style="color:${S.t2};font-size:13px;">XRP <span style="color:${S.t1};font-weight:700;font-family:monospace;">$${xrp.price.toFixed(4)}</span> <span style="color:${xrp.change24h >= 0 ? S.green : S.red};">${fmt(xrp.change24h)}% 24h</span></div>` : ""}
    </div>` : ""}
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(125,184,232,0.08);text-align:center;color:${S.t4};font-size:11px;">M.A.X. &middot; Maximum Adaptive eXecutive</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

      await resend.emails.send({
        from: "M.A.X. <onboarding@resend.dev>",
        to: ["maxbillion2003@gmail.com"],
        subject: `M.A.X. Weekly Recap — ${date}`,
        html,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Weekly recap error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
