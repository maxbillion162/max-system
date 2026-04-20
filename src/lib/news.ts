import Parser from "rss-parser";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  tag: string;
  bias: string;
  pubDate: string;
  snippet: string;
}

const FEEDS = [
  { url: "https://techcrunch.com/feed/",                    source: "TechCrunch",  tag: "Tech",    bias: "C-L" },
  { url: "https://www.theverge.com/rss/index.xml",          source: "The Verge",   tag: "Tech",    bias: "C-L" },
  { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",  source: "WSJ Markets", tag: "Finance", bias: "C-R" },
  { url: "https://cointelegraph.com/rss",                   source: "CoinTelegraph",tag: "Crypto", bias: "C"   },
  { url: "https://feeds.npr.org/1004/rss.xml",              source: "NPR",         tag: "Politics","bias": "C-L" },
  { url: "https://feeds.feedburner.com/oreilly/radar",      source: "O'Reilly",    tag: "AI",      bias: "C"   },
];

// Fallback if O'Reilly doesn't have AI content
const AI_FEED = {
  url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
  source: "NY Times Tech", tag: "Tech", bias: "C-L",
};

function stripHtml(html: string): string {
  return html?.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim().slice(0, 160) ?? "";
}

export async function fetchNews(count = 6): Promise<NewsItem[]> {
  const parser = new Parser({ timeout: 5000 });
  const items: NewsItem[] = [];

  await Promise.allSettled(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        const top = parsed.items.slice(0, 2);
        for (const item of top) {
          items.push({
            title: item.title ?? "",
            link: item.link ?? "",
            source: feed.source,
            tag: feed.tag,
            bias: feed.bias,
            pubDate: item.pubDate ?? "",
            snippet: stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? ""),
          });
        }
      } catch {
        // Feed failed silently — other feeds still populate
      }
    })
  );

  // Sort by pubDate descending, return top N
  return items
    .filter(i => i.title.length > 10)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, count);
}
