import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, storeTokens } from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect("/dashboard?google=error");
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    await storeTokens({
      access_token: tokens.access_token ?? "",
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    });
    return NextResponse.redirect(new URL("/dashboard?google=connected", req.nextUrl.origin));
  } catch (e) {
    console.error("Google OAuth callback error:", e);
    return NextResponse.redirect(new URL("/dashboard?google=error", req.nextUrl.origin));
  }
}
