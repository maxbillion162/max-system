import type { WeatherData } from "./weather";
import type { CryptoAsset } from "./crypto";
import type { NewsItem } from "./news";

export interface BriefingData {
  weather: WeatherData;
  crypto: CryptoAsset[];
  news: NewsItem[];
  date: string;
}

function conditionEmoji(code: number): string {
  if (code === 0)   return "☀️";
  if (code <= 2)    return "⛅";
  if (code === 3)   return "☁️";
  if (code <= 49)   return "🌫️";
  if (code <= 67)   return "🌧️";
  if (code >= 95)   return "⛈️";
  return "🌤️";
}

function pct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

const BIAS_LABEL: Record<string, string> = {
  L: "Left", "C-L": "Center-Left", C: "Center", "C-R": "Center-Right", R: "Right",
};

const QUOTES = [
  "The secret of getting ahead is getting started. — Mark Twain",
  "Success is the sum of small efforts repeated day in and day out. — Robert Collier",
  "Work hard in silence. Let success make the noise.",
  "The harder I work, the luckier I get. — Gary Player",
  "Don't watch the clock; do what it does. Keep going. — Sam Levenson",
  "It's not about having time. It's about making time.",
];

export function buildBriefingEmail(data: BriefingData): string {
  const { weather, crypto, news, date } = data;
  const btc = crypto.find(c => c.symbol === "BTC");
  const xrp = crypto.find(c => c.symbol === "XRP");
  const quote = QUOTES[new Date().getDay() % QUOTES.length];

  const forecastRows = weather.forecast.map(f =>
    `<tr>
      <td style="padding:6px 12px;color:#94a3b8;font-size:13px;">${f.day}</td>
      <td style="padding:6px 12px;color:#f0f9ff;font-size:13px;font-weight:600;">${f.high}° / ${f.low}°</td>
      <td style="padding:6px 12px;color:#64748b;font-size:13px;">${f.precipChance}% rain</td>
    </tr>`
  ).join("");

  const newsRows = news.map(n =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #1e293b;">
        <a href="${n.link}" style="color:#e0f2fe;font-size:14px;font-weight:600;text-decoration:none;display:block;margin-bottom:4px;">${n.title}</a>
        <span style="color:#475569;font-size:12px;">${n.source}</span>
        <span style="margin-left:8px;padding:2px 8px;background:rgba(6,182,212,0.1);color:#06b6d4;border-radius:4px;font-size:11px;font-weight:600;">${n.tag}</span>
        <span style="margin-left:4px;padding:2px 8px;background:rgba(16,185,129,0.1);color:#10b981;border-radius:4px;font-size:11px;font-weight:600;">Bias: ${BIAS_LABEL[n.bias] ?? n.bias}</span>
      </td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>M.A.X. Daily Briefing</title></head>
<body style="margin:0;padding:0;background:#04060f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#04060f;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#07101e,#050d1a);border:1px solid rgba(6,182,212,0.15);border-radius:16px 16px 0 0;padding:32px 36px;text-align:center;">
          <div style="width:52px;height:52px;background:linear-gradient(135deg,#0b2040,#071428);border:1px solid rgba(6,182,212,0.4);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
            <span style="color:#06b6d4;font-size:22px;font-weight:900;">M</span>
          </div>
          <div style="color:#06b6d4;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">Daily Briefing</div>
          <div style="color:#f0f9ff;font-size:24px;font-weight:900;margin-bottom:4px;">Good Morning, Max.</div>
          <div style="color:#475569;font-size:13px;">${date}</div>
        </td></tr>

        <!-- Weather -->
        <tr><td style="background:#07101e;border:1px solid rgba(6,182,212,0.08);border-top:none;padding:28px 36px;">
          <div style="color:#475569;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;">☀️ Orlando Weather</div>
          <div style="display:flex;align-items:flex-end;gap:16px;margin-bottom:8px;">
            <span style="color:#f97316;font-size:52px;font-weight:900;line-height:1;">${conditionEmoji(weather.conditionCode)} ${weather.tempF}°F</span>
            <span style="color:#94a3b8;font-size:15px;margin-bottom:8px;">${weather.condition}</span>
          </div>
          <div style="color:#475569;font-size:13px;margin-bottom:20px;">Feels like ${weather.feelsLikeF}° · Wind ${weather.windMph}mph · Rain ${weather.precipChance}%</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#050d1a;border-radius:8px;border:1px solid rgba(6,182,212,0.06);">
            ${forecastRows}
          </table>
        </td></tr>

        <!-- Crypto -->
        <tr><td style="background:#07101e;border:1px solid rgba(6,182,212,0.08);border-top:none;padding:28px 36px;">
          <div style="color:#475569;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;">📈 Crypto Portfolio</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[btc, xrp].filter(Boolean).map(c => `
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:12px 0;">
                <div style="color:#f0f9ff;font-size:16px;font-weight:700;">${c!.symbol} <span style="color:#64748b;font-weight:400;font-size:13px;">${c!.name}</span></div>
              </td>
              <td style="padding:12px 0;text-align:right;">
                <div style="color:#f0f9ff;font-size:16px;font-weight:700;font-family:monospace;">$${c!.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                <div style="color:${c!.change24h >= 0 ? "#10b981" : "#f43f5e"};font-size:13px;font-weight:600;">${pct(c!.change24h)} (24h) · ${pct(c!.change7d)} (7d)</div>
              </td>
            </tr>`).join("")}
          </table>
        </td></tr>

        <!-- News -->
        <tr><td style="background:#07101e;border:1px solid rgba(6,182,212,0.08);border-top:none;padding:28px 36px;">
          <div style="color:#475569;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;">📡 Intelligence Feed</div>
          <table width="100%" cellpadding="0" cellspacing="0">${newsRows}</table>
        </td></tr>

        <!-- Quote -->
        <tr><td style="background:linear-gradient(135deg,#07101e,#050d1a);border:1px solid rgba(6,182,212,0.08);border-top:none;border-radius:0 0 16px 16px;padding:28px 36px;text-align:center;">
          <div style="color:#1e3a5f;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">Today's Quote</div>
          <div style="color:#7dd3fc;font-size:15px;font-style:italic;line-height:1.6;">"${quote}"</div>
          <div style="margin-top:24px;padding-top:20px;border-top:1px solid #0f1c34;color:#1e3a5f;font-size:11px;">
            M.A.X. · Maximum Adaptive eXecutive · Built for Max
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
