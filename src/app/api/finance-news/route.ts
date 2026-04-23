import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return NextResponse.json({ articles: [] });

  const query = "Bitcoin XRP cryptocurrency stock market S&P 500 Federal Reserve interest rates investing news today";

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, max_results: 8, search_depth: "basic", topic: "finance" }),
    });

    if (!res.ok) return NextResponse.json({ articles: [] });

    const data = await res.json();
    const articles = (data.results ?? []).map((r: { title: string; url: string; content: string; published_date?: string }) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content ?? "").slice(0, 240),
      published: r.published_date ?? null,
    }));

    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ articles: [] });
  }
}
