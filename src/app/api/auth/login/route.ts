import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { sendNotification } from "@/app/api/telegram/route";

const COOKIE = "max_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function timingSafeEqStr(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Throttle failed-attempt alerts so a spammer can't flood your Telegram.
// One alert per (ip, minute). Successful logins always alert.
const lastFailAlert = new Map<string, number>();
function shouldAlertFail(ip: string): boolean {
  const now = Date.now();
  const last = lastFailAlert.get(ip) ?? 0;
  if (now - last < 60_000) return false;
  lastFailAlert.set(ip, now);
  return true;
}

async function notifyLogin(ok: boolean, req: Request) {
  const ip = clientIp(req);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 80);
  const time = new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false });
  if (ok) {
    await sendNotification(`✅ *Login successful*\n${time} ET · IP \`${ip}\`\n${ua}`).catch(() => {});
  } else {
    if (!shouldAlertFail(ip)) return;
    await sendNotification(`⚠️ *Failed login attempt*\n${time} ET · IP \`${ip}\`\n${ua}`).catch(() => {});
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { key: "login", limit: 10, windowMs: 60_000 });
  if (limited) {
    notifyLogin(false, request).catch(() => {});
    return limited;
  }
  try {
    const { password } = (await request.json()) as { password?: string };
    const correct = process.env.MAX_PASSWORD;
    const sessionSecret = process.env.SESSION_SECRET;

    if (!correct || !sessionSecret) {
      return NextResponse.json({ ok: false, error: "server not configured" }, { status: 503 });
    }
    if (typeof password !== "string" || !timingSafeEqStr(password, correct)) {
      notifyLogin(false, request).catch(() => {});
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const jar = await cookies();
    jar.set(COOKIE, sessionSecret, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    notifyLogin(true, request).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(COOKIE);
  return NextResponse.json({ ok: true });
}
