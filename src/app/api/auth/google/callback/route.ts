import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOAuthClient, storeTokens } from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const stateCookie = jar.get("oauth_state_google")?.value;
  jar.delete("oauth_state_google");

  if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
    return NextResponse.redirect(new URL("/dashboard?google=error", req.nextUrl.origin));
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
  } catch {
    return NextResponse.redirect(new URL("/dashboard?google=error", req.nextUrl.origin));
  }
}
