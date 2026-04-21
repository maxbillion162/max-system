import type { WeatherData } from "./weather";
import type { CryptoAsset } from "./crypto";
import type { NewsItem } from "./news";

export interface HabitData {
  name: string;
  completed: boolean;
  streak: number;
}

export interface TaskData {
  text: string;
  priority: string;
  due_date?: string;
}

export interface CalEventData {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
}

export interface BriefingData {
  weather: WeatherData;
  crypto: CryptoAsset[];
  news: NewsItem[];
  date: string;
  habits?: HabitData[];
  tasks?: TaskData[];
  calendarEvents?: CalEventData[];
}

function pct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" });
}

const QUOTES = [
  "The secret of getting ahead is getting started. — Mark Twain",
  "Work hard in silence. Let success make the noise.",
  "The harder I work, the luckier I get. — Gary Player",
  "Don't watch the clock; do what it does. Keep going. — Sam Levenson",
  "Opportunities don't happen. You create them. — Chris Grosser",
  "Success is the sum of small efforts repeated day in and day out. — Robert Collier",
  "Your income right now is the result of your standards. — Tony Robbins",
];

function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2)  return "⛅";
  if (code === 3) return "☁️";
  if (code <= 49) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

const S = {
  bg: "#04060f", card: "#07101e", cardAlt: "#050d1a",
  border: "rgba(69,137,255,0.12)", borderFaint: "rgba(69,137,255,0.06)",
  blue: "#4589ff", green: "#22c55e", red: "#ef4444", amber: "#f59e0b",
  t1: "#f0f9ff", t2: "#94a3b8", t3: "#475569", t4: "#1e3a5f",
};

export function buildBriefingEmail(data: BriefingData): string {
  const { weather, crypto, news, date, habits = [], tasks = [], calendarEvents = [] } = data;
  const btc = crypto.find(c => c.symbol === "BTC");
  const xrp = crypto.find(c => c.symbol === "XRP");
  const quote = QUOTES[new Date().getDay() % QUOTES.length];

  const btcVal     = btc ? btc.price * 0.02 : 0;
  const xrpVal     = xrp ? xrp.price * 200 : 0;
  const cryptoTotal = btcVal + xrpVal;
  const iraTotal   = 2720;
  const savings    = 2800;
  const netWorth   = cryptoTotal + iraTotal + savings;

  const habitsDone  = habits.filter(h => h.completed).length;
  const habitsTotal = habits.length;
  const topStreak   = habits.reduce((max, h) => Math.max(max, h.streak ?? 0), 0);
  const openTasks   = tasks.filter(t => !("completed" in t));
  const highTasks   = openTasks.filter(t => t.priority === "high");
  const todayTasks  = tasks.filter(t => {
    if (!t.due_date) return false;
    const today = new Date().toLocaleDateString("en-CA");
    return t.due_date === today;
  });

  const forecastRows = weather.forecast.slice(0, 5).map(f =>
    `<tr>
      <td style="padding:8px 16px;color:${S.t2};font-size:13px;border-bottom:1px solid ${S.borderFaint};">${f.day}</td>
      <td style="padding:8px 16px;color:${S.t1};font-size:13px;font-weight:700;font-family:monospace;border-bottom:1px solid ${S.borderFaint};">${f.high}° / ${f.low}°</td>
      <td style="padding:8px 16px;color:${S.t3};font-size:13px;border-bottom:1px solid ${S.borderFaint};">${f.precipChance ?? 0}% rain</td>
    </tr>`
  ).join("");

  const newsRows = news.slice(0, 8).map(n =>
    `<tr><td style="padding:12px 0;border-bottom:1px solid ${S.borderFaint};">
      <a href="${n.link}" style="color:${S.t1};font-size:14px;font-weight:600;text-decoration:none;display:block;line-height:1.4;margin-bottom:5px;">${n.title}</a>
      <span style="color:${S.t3};font-size:12px;">${n.source}</span>
      <span style="margin-left:8px;padding:2px 7px;background:rgba(69,137,255,0.1);color:${S.blue};border-radius:4px;font-size:11px;font-weight:700;">${n.tag}</span>
    </td></tr>`
  ).join("");

  const habitsRows = habits.length > 0 ? habits.map(h =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid ${S.borderFaint};">
        <span style="font-size:14px;margin-right:8px;">${h.completed ? "✅" : "⬜"}</span>
        <span style="color:${h.completed ? S.t1 : S.t2};font-size:13px;font-weight:${h.completed ? "600" : "400"};">${h.name}</span>
      </td>
      <td style="padding:8px 0;text-align:right;border-bottom:1px solid ${S.borderFaint};">
        ${h.streak > 1 ? `<span style="color:${S.amber};font-size:12px;font-weight:700;">🔥 ${h.streak} day streak</span>` : ""}
      </td>
    </tr>`
  ).join("") : `<tr><td style="padding:12px 0;color:${S.t3};font-size:13px;">No habits tracked yet.</td></tr>`;

  const calRows = calendarEvents.length > 0 ? calendarEvents.slice(0, 6).map(e =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid ${S.borderFaint};">
        <div style="color:${S.t1};font-size:13px;font-weight:600;">${e.title}</div>
        <div style="color:${S.t3};font-size:12px;margin-top:3px;">
          ${e.allDay ? "All day" : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}
          ${e.location ? ` · ${e.location}` : ""}
        </div>
      </td>
    </tr>`
  ).join("") : `<tr><td style="padding:12px 0;color:${S.t3};font-size:13px;">No events today.</td></tr>`;

  const taskRows = todayTasks.length > 0 ? todayTasks.map(t =>
    `<div style="padding:8px 12px;margin-bottom:6px;border-radius:6px;background:rgba(255,255,255,0.03);border-left:2px solid ${t.priority === "high" ? S.red : t.priority === "medium" ? S.amber : S.blue};">
      <span style="color:${S.t1};font-size:13px;">${t.text}</span>
    </div>`
  ).join("") : (openTasks.length > 0 ?
    `<div style="color:${S.t3};font-size:13px;">${openTasks.length} open task${openTasks.length > 1 ? "s" : ""}${highTasks.length > 0 ? ` · <span style="color:${S.red};font-weight:600;">${highTasks.length} high priority</span>` : ""}</div>`
    : `<div style="color:${S.t3};font-size:13px;">No tasks due today.</div>`);

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${S.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${S.bg};padding:40px 20px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,${S.card},${S.cardAlt});border:1px solid ${S.border};border-radius:16px 16px 0 0;padding:36px;text-align:center;">
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
      <tr><td style="width:52px;height:52px;background:linear-gradient(135deg,#080f1c,#050c18);border:1px solid rgba(69,137,255,0.3);border-radius:12px;text-align:center;vertical-align:middle;">
        <span style="color:${S.blue};font-size:22px;font-weight:900;">M</span>
      </td></tr>
    </table>
    <div style="color:${S.blue};font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">M.A.X. · DAILY BRIEFING</div>
    <div style="color:${S.t1};font-size:26px;font-weight:900;margin-bottom:6px;">Good morning, Max.</div>
    <div style="color:${S.t3};font-size:13px;">${date}</div>
  </td></tr>

  <!-- NET WORTH -->
  <tr><td style="background:linear-gradient(135deg,#071828,#050d1a);border:1px solid ${S.border};border-top:none;padding:24px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="color:${S.t3};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">Tracked Net Worth</div>
        <div style="color:${S.t1};font-size:36px;font-weight:900;font-family:monospace;">$${netWorth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:3px 0;color:${S.t3};font-size:12px;text-align:right;">Crypto</td><td style="padding:3px 0 3px 16px;color:${S.amber};font-size:13px;font-weight:700;font-family:monospace;">$${cryptoTotal.toFixed(2)}</td></tr>
          <tr><td style="padding:3px 0;color:${S.t3};font-size:12px;text-align:right;">Roth IRA</td><td style="padding:3px 0 3px 16px;color:${S.blue};font-size:13px;font-weight:700;font-family:monospace;">$${iraTotal.toFixed(2)}</td></tr>
          <tr><td style="padding:3px 0;color:${S.t3};font-size:12px;text-align:right;">Savings</td><td style="padding:3px 0 3px 16px;color:${S.green};font-size:13px;font-weight:700;font-family:monospace;">$${savings.toFixed(2)}</td></tr>
        </table>
      </td>
    </tr></table>
  </td></tr>

  <!-- TODAY AT A GLANCE -->
  <tr><td style="background:${S.card};border:1px solid ${S.border};border-top:none;padding:24px 36px;">
    <div style="color:${S.t3};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;">⚡ Today at a Glance</div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="width:23%;padding:14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.12);border-radius:8px;text-align:center;">
        <div style="color:${S.green};font-size:22px;font-weight:900;">${habitsTotal > 0 ? `${habitsDone}/${habitsTotal}` : "—"}</div>
        <div style="color:${S.t3};font-size:11px;margin-top:3px;">Habits done</div>
      </td>
      <td style="width:4%;"></td>
      <td style="width:23%;padding:14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.12);border-radius:8px;text-align:center;">
        <div style="color:${S.amber};font-size:22px;font-weight:900;">${topStreak > 0 ? topStreak : "—"}</div>
        <div style="color:${S.t3};font-size:11px;margin-top:3px;">Top streak</div>
      </td>
      <td style="width:4%;"></td>
      <td style="width:23%;padding:14px;background:rgba(69,137,255,0.06);border:1px solid rgba(69,137,255,0.12);border-radius:8px;text-align:center;">
        <div style="color:${S.blue};font-size:22px;font-weight:900;">${openTasks.length}</div>
        <div style="color:${S.t3};font-size:11px;margin-top:3px;">Open tasks</div>
      </td>
      <td style="width:4%;"></td>
      <td style="width:23%;padding:14px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.12);border-radius:8px;text-align:center;">
        <div style="color:${S.red};font-size:22px;font-weight:900;">${highTasks.length}</div>
        <div style="color:${S.t3};font-size:11px;margin-top:3px;">High priority</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- CALENDAR -->
  <tr><td style="background:${S.card};border:1px solid ${S.border};border-top:none;padding:24px 36px;">
    <div style="color:${S.t3};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;">📅 Today&apos;s Calendar</div>
    <table width="100%" cellpadding="0" cellspacing="0">${calRows}</table>
  </td></tr>

  <!-- TASKS DUE TODAY -->
  ${todayTasks.length > 0 ? `
  <tr><td style="background:${S.card};border:1px solid ${S.border};border-top:none;padding:24px 36px;">
    <div style="color:${S.t3};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;">✅ Tasks Due Today</div>
    ${taskRows}
  </td></tr>` : ""}

  <!-- HABITS -->
  ${habits.length > 0 ? `
  <tr><td style="background:${S.card};border:1px solid ${S.border};border-top:none;padding:24px 36px;">
    <div style="color:${S.t3};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;">🏋️ Habits</div>
    <table width="100%" cellpadding="0" cellspacing="0">${habitsRows}</table>
  </td></tr>` : ""}

  <!-- CRYPTO -->
  <tr><td style="background:${S.card};border:1px solid ${S.border};border-top:none;padding:24px 36px;">
    <div style="color:${S.t3};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;">📈 Crypto Holdings</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[btc, xrp].filter(Boolean).map(c => `
      <tr style="border-bottom:1px solid ${S.borderFaint};">
        <td style="padding:12px 0;">
          <div style="color:${S.t1};font-size:15px;font-weight:700;">${c!.symbol} <span style="color:${S.t3};font-weight:400;font-size:13px;">${c!.name}</span></div>
          <div style="color:${S.t3};font-size:12px;margin-top:2px;">${c!.symbol === "BTC" ? "0.02 BTC" : "200 XRP"} · Value: <span style="color:${S.t1};font-weight:600;">$${(c!.symbol === "BTC" ? c!.price * 0.02 : c!.price * 200).toFixed(2)}</span></div>
        </td>
        <td style="padding:12px 0;text-align:right;">
          <div style="color:${S.t1};font-size:15px;font-weight:700;font-family:monospace;">$${c!.symbol === "BTC" ? Math.round(c!.price).toLocaleString() : c!.price.toFixed(4)}</div>
          <div style="font-size:12px;font-weight:600;margin-top:2px;">
            <span style="color:${c!.change24h >= 0 ? S.green : S.red};">${pct(c!.change24h)} 24h</span>
            <span style="color:${S.t3};"> · </span>
            <span style="color:${c!.change7d >= 0 ? S.green : S.red};">${pct(c!.change7d)} 7d</span>
          </div>
        </td>
      </tr>`).join("")}
    </table>
  </td></tr>

  <!-- WEATHER -->
  <tr><td style="background:${S.card};border:1px solid ${S.border};border-top:none;padding:24px 36px;">
    <div style="color:${S.t3};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;">${weatherIcon(weather.conditionCode)} Orlando Weather</div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="color:${S.t1};font-size:48px;font-weight:900;line-height:1;font-family:monospace;">${weather.tempF}°F</div>
        <div style="color:${S.t2};font-size:14px;margin-top:4px;">${weather.condition}</div>
        <div style="color:${S.t3};font-size:12px;margin-top:6px;">Feels ${weather.feelsLikeF}° · Wind ${weather.windMph}mph · Rain ${weather.precipChance}%</div>
      </td>
      <td style="vertical-align:top;">
        <table cellpadding="0" cellspacing="0" style="background:${S.cardAlt};border-radius:8px;border:1px solid ${S.borderFaint};width:220px;">${forecastRows}</table>
      </td>
    </tr></table>
  </td></tr>

  <!-- NEWS -->
  <tr><td style="background:${S.card};border:1px solid ${S.border};border-top:none;padding:24px 36px;">
    <div style="color:${S.t3};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;">📡 Intelligence Feed</div>
    <table width="100%" cellpadding="0" cellspacing="0">${newsRows}</table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:linear-gradient(135deg,${S.card},${S.cardAlt});border:1px solid ${S.border};border-top:none;border-radius:0 0 16px 16px;padding:28px 36px;text-align:center;">
    <div style="color:${S.t4};font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">Today&apos;s Quote</div>
    <div style="color:#7dd3fc;font-size:14px;font-style:italic;line-height:1.7;max-width:460px;margin:0 auto;">&ldquo;${quote}&rdquo;</div>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #0f1c34;color:${S.t4};font-size:11px;">M.A.X. &middot; Maximum Adaptive eXecutive &middot; Built exclusively for Max</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
