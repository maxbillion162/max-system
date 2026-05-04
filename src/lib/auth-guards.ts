import { NextResponse } from "next/server";

export function requireCron(req: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) return null;
  const got = req.headers.get("authorization");
  if (got === `Bearer ${expected}`) return null;
  return new NextResponse("unauthorized", { status: 401 });
}

export function requireTelegram(req: Request): NextResponse | null {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return null;
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  if (got === expected) return null;
  return new NextResponse("unauthorized", { status: 401 });
}
