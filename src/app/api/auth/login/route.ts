import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "max_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function timingSafeEqStr(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(request: Request) {
  try {
    const { password } = (await request.json()) as { password?: string };
    const correct = process.env.MAX_PASSWORD;
    const sessionSecret = process.env.SESSION_SECRET;

    if (!correct || !sessionSecret) {
      return NextResponse.json({ ok: false, error: "server not configured" }, { status: 503 });
    }
    if (typeof password !== "string" || !timingSafeEqStr(password, correct)) {
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
