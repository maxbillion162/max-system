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
  { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",           source: "WSJ Markets",    tag: "Finance",  bias: "C-R" },
  { url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml",         source: "WSJ Business",   tag: "Finance",  bias: "C-R" },
  { url: "https://www.ft.com/rss/home",                              source: "Financial Times", tag: "Finance", bias: "C"   },
  { url: "https://feeds.bloomberg.com/markets/news.rss",             source: "Bloomberg",      tag: "Finance",  bias: "C"   },
  { url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",    source: "CNBC Markets",   tag: "Finance",  bias: "C"   },
  { url: "https://www.cnbc.com/id/10001147/device/rss/rss.html",    source: "CNBC Business",  tag: "Finance",  bias: "C"   },
  // Crypto
  { url: "https://cointelegraph.com/rss",                            source: "CoinTelegraph",  tag: "Crypto",   bias: "C"   },
  { url: "https://coindesk.com/arc/outboundfeeds/rss/",              source: "CoinDesk",       tag: "Crypto",   bias: "C"   },
  { url: "https://decrypt.co/feed",                                  source: "Decrypt",        tag: "Crypto",   bias: "C"   },
  // Politics / Breaking
  { url: "https://feeds.npr.org/1001/rss.xml",                       source: "NPR",            tag: "Politics", bias: "C-L" },
  { url: "https://rss.politico.com/politics-news.xml",               source: "Politico",       tag: "Politics", bias: "C-L" },
  { url: "https://feeds.reuters.com/reuters/topNews",                source: "Reuters",        tag: "Breaking", bias: "C"   },
  { url: "https://feeds.reuters.com/reuters/businessNews",           source: "Reuters Biz",    tag: "Finance",  bias: "C"   },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",source: "NY Times",       tag: "Breaking", bias: "C-L" },
  { url: "https://feeds.bbci.co.uk/news/rss.xml",                   source: "BBC News",       tag: "Breaking", bias: "C-L" },
  // AI / Tech
  { url: "https://techcrunch.com/feed/",                             source: "TechCrunch",     tag: "Tech",     bias: "C-L" },
  { url: "https://www.theverge.com/rss/index.xml",                   source: "The Verge",      tag: "Tech",     bias: "C-L" },
  { url: "https://venturebeat.com/feed/",                            source: "VentureBeat",    tag: "AI",       bias: "C"   },
];

const BREAKING_KEYWORDS = ["breaking", "urgent", "just in", "alert", "developing", "live updates", "emergency", "crisis", "crash", "surge", "record", "historic"];

function stripHtml(html: string): string {
  return html?.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim().slice(0, 200) ?? "";
}

function isBreaking(title: string, pubDate: string): boolean {
  const titleLower = title.toLowerCase();
  const isRecent = pubDate ? (Date.now() - new Date(pubDate).getTime()) < 2 * 60 * 60 * 1000 : false;
  const hasKeyword = BREAKING_KEYWORDS.some(k => titleLower.includes(k));
  return hasKeyword || (isRecent && titleLower.length > 0);
}

export async function fetchNews(count = 30): Promise<NewsItem[]> {
  const parser = new Parser({ timeout: 6000 });
  const items: NewsItem[] = [];

  await Promise.allSettled(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        const top = parsed.items.slice(0, 4);
        for (const item of top) {
          const title = item.title ?? "";
          const pubDate = item.pubDate ?? "";
          items.push({
            title,
            link: item.link ?? "",
            source: feed.source,
            tag: feed.tag,
            bias: feed.bias,
            pubDate,
            snippet: stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? ""),
            breaking: isBreaking(title, pubDate),
          });
        }
      } catch {
        // Feed failed silently
      }
    })
  );

  const filtered = items.filter(i => i.title.length > 10);
  const sorted = filtered.sort((a, b) => {
    // Breaking news first, then by date
    if (a.breaking && !b.breaking) return -1;
    if (!a.breaking && b.breaking) return 1;
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });

  return sorted.slice(0, count);
}
