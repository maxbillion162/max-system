import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/dashboard/settings?spotify=denied", req.url));
  }

  const result = await exchangeCode(code);
  if (!result.success) {
    return NextResponse.redirect(new URL("/dashboard/settings?spotify=error", req.url));
  }

  return NextResponse.redirect(new URL("/dashboard/settings?spotify=connected", req.url));
}
