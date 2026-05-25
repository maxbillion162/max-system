import Parser from "rss-parser";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  tag: string;
  bias: string;
  pubDate: string;
  snippet: string;
  breaking?: boolean;
}

const FEEDS = [
  // Finance
  { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",                  source: "WSJ Markets",      tag: "Finance",  bias: "C-R" },
  { url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml",                source: "WSJ Business",     tag: "Finance",  bias: "C-R" },
  { url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",           source: "CNBC Markets",     tag: "Finance",  bias: "C"   },
  { url: "https://www.cnbc.com/id/10001147/device/rss/rss.html",           source: "CNBC Business",    tag: "Finance",  bias: "C"   },
  { url: "https://feeds.reuters.com/reuters/businessNews",                  source: "Reuters Biz",      tag: "Finance",  bias: "C"   },
  { url: "https://feeds.marketwatch.com/marketwatch/topstories/",          source: "MarketWatch",      tag: "Finance",  bias: "C"   },
  { url: "https://feeds.marketwatch.com/marketwatch/marketpulse/",         source: "MarketWatch Pulse",tag: "Finance",  bias: "C"   },
  // Crypto
  { url: "https://cointelegraph.com/rss",                                   source: "CoinTelegraph",    tag: "Crypto",   bias: "C"   },
  { url: "https://coindesk.com/arc/outboundfeeds/rss/",                     source: "CoinDesk",         tag: "Crypto",   bias: "C"   },
  { url: "https://decrypt.co/feed",                                         source: "Decrypt",          tag: "Crypto",   bias: "C"   },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/category/markets/",source: "CoinDesk Markets", tag: "Crypto",   bias: "C"   },
  // Politics / Breaking
  { url: "https://feeds.npr.org/1001/rss.xml",                             source: "NPR",              tag: "Politics", bias: "C-L" },
  { url: "https://rss.politico.com/politics-news.xml",                     source: "Politico",         tag: "Politics", bias: "C-L" },
  { url: "https://thehill.com/feed/",                                      source: "The Hill",         tag: "Politics", bias: "C"   },
  { url: "https://feeds.reuters.com/reuters/topNews",                      source: "Reuters",          tag: "Breaking", bias: "C"   },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",     source: "NY Times",         tag: "Breaking", bias: "C-L" },
  { url: "https://feeds.bbci.co.uk/news/rss.xml",                         source: "BBC News",         tag: "Breaking", bias: "C-L" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml",                   source: "BBC World",        tag: "Politics", bias: "C-L" },
  { url: "https://feeds.npr.org/1004/rss.xml",                            source: "NPR Politics",     tag: "Politics", bias: "C-L" },
  { url: "https://apnews.com/rss",                                        source: "AP News",          tag: "Breaking", bias: "C"   },
  // Florida
  { url: "https://www.orlandosentinel.com/feed/",                         source: "Orlando Sentinel", tag: "Politics", bias: "C"   },
  { url: "https://www.tampabay.com/feed/",                               source: "Tampa Bay Times",   tag: "Politics", bias: "C"   },
  // AI
  { url: "https://venturebeat.com/category/ai/feed/",                    source: "VentureBeat AI",   tag: "AI",       bias: "C"   },
  { url: "https://www.artificialintelligence-news.com/feed/",            source: "AI News",          tag: "AI",       bias: "C"   },
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/",source: "TechCrunch AI",    tag: "AI",       bias: "C-L" },
  { url: "https://www.wired.com/feed/tag/artificial-intelligence/rss",   source: "Wired AI",         tag: "AI",       bias: "C-L" },
  // Tech
  { url: "https://techcrunch.com/feed/",                                 source: "TechCrunch",       tag: "Tech",     bias: "C-L" },
  { url: "https://www.theverge.com/rss/index.xml",                       source: "The Verge",        tag: "Tech",     bias: "C-L" },
  { url: "https://arstechnica.com/feed/",                               source: "Ars Technica",      tag: "Tech",     bias: "C"   },
  { url: "https://www.wired.com/feed/rss",                              source: "Wired",             tag: "Tech",     bias: "C-L" },
];

const BREAKING_KEYWORDS = ["breaking", "urgent", "just in", "alert", "developing", "live updates", "emergency", "crisis", "crash", "surge", "record", "historic"];

function stripHtml(html: string): string {
  return html?.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim().slice(0, 200) ?? "";
}

function isBreaking(title: string): boolean {
  const titleLower = title.toLowerCase();
  return BREAKING_KEYWORDS.some(k => titleLower.includes(k));
}

export async function fetchNews(count = 200): Promise<NewsItem[]> {
  const parser = new Parser({ timeout: 8000 });
  const items: NewsItem[] = [];

  await Promise.allSettled(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        const top = parsed.items.slice(0, 8);
        for (const item of top) {
          const title = item.title ?? "";
          const pubDate = item.pubDate ?? new Date().toISOString();
          items.push({
            title,
            link: item.link ?? "",
            source: feed.source,
            tag: feed.tag,
            bias: feed.bias,
            pubDate,
            snippet: stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? ""),
            breaking: isBreaking(title),
          });
        }
      } catch {
        // Feed failed silently
      }
    })
  );

  const seen = new Set<string>();
  const deduped = items.filter(i => {
    if (i.title.length < 10) return false;
    const key = i.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()).slice(0, count);
}
