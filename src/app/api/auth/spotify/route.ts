import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthUrl } from "@/lib/spotify";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomBytes(32).toString("hex");
  const jar = await cookies();
  jar.set("oauth_state_spotify", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(getAuthUrl(state));
}
