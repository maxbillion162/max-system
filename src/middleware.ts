import { NextRequest, NextResponse } from "next/server";

const COOKIE = "max_session";

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/google/",
  "/api/auth/spotify/",
  "/api/telegram",
  "/api/cron/",
  "/api/briefing",
  "/api/admin/", // TEMP: remove after memory reset
];

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) return NextResponse.next();

  const cookieVal = req.cookies.get(COOKIE)?.value;
  const authed = cookieVal === sessionSecret;

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) return NextResponse.next();
    if (!authed) {
      return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    if (!authed) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};
