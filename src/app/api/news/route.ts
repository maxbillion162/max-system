import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/news";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = parseInt(searchParams.get("count") ?? "6");

  try {
    const data = await fetchNews(count);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("News fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}
