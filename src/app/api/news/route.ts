import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/news";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = parseInt(searchParams.get("count") ?? "6");
  const topic = searchParams.get("topic");

  try {
    if (topic) {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: topic, max_results: count, search_depth: "advanced", include_answer: false }),
      });
      const json = await res.json();
      const data = (json.results ?? []).map((r: { title: string; url: string; content?: string; published_date?: string }) => ({
        title:    r.title,
        link:     r.url,
        source:   (() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return r.url; } })(),
        tag:      "Topic",
        bias:     "C",
        pubDate:  r.published_date ?? new Date().toISOString(),
        snippet:  (r.content ?? "").slice(0, 200),
        breaking: false,
      }));
      return NextResponse.json({ data, topic });
    }

    const data = await fetchNews(count);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("News fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}
