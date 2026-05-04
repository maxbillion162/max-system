import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const stateParam = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const stateCookie = jar.get("oauth_state_spotify")?.value;
  jar.delete("oauth_state_spotify");

  if (error || !code || !stateParam || !stateCookie || stateParam !== stateCookie) {
    return NextResponse.redirect(new URL("/dashboard/settings?spotify=error", req.url));
  }

  const result = await exchangeCode(code);
  if (!result.success) {
    return NextResponse.redirect(new URL("/dashboard/settings?spotify=error", req.url));
  }

  return NextResponse.redirect(new URL("/dashboard/settings?spotify=connected", req.url));
}
