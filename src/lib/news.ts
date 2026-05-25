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
  relevance?: number;
}

// Category-specific feeds only — no generic site RSS that bleeds in deals/reviews
const FEEDS = [
  // Finance
  { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",                   source: "WSJ Markets",       tag: "Finance",  bias: "C-R" },
  { url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",            source: "CNBC Markets",      tag: "Finance",  bias: "C"   },
  { url: "https://www.cnbc.com/id/10001147/device/rss/rss.html",            source: "CNBC Business",     tag: "Finance",  bias: "C"   },
  { url: "https://feeds.marketwatch.com/marketwatch/topstories/",           source: "MarketWatch",       tag: "Finance",  bias: "C"   },
  { url: "https://feeds.reuters.com/reuters/businessNews",                   source: "Reuters Business",  tag: "Finance",  bias: "C"   },
  { url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml",                 source: "WSJ Business",      tag: "Finance",  bias: "C-R" },

  // Crypto
  { url: "https://cointelegraph.com/rss",                                    source: "CoinTelegraph",     tag: "Crypto",   bias: "C"   },
  { url: "https://coindesk.com/arc/outboundfeeds/rss/",                      source: "CoinDesk",          tag: "Crypto",   bias: "C"   },
  { url: "https://decrypt.co/feed",                                          source: "Decrypt",           tag: "Crypto",   bias: "C"   },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/category/markets/", source: "CoinDesk Markets",  tag: "Crypto",   bias: "C"   },

  // Breaking — wire services only, highest signal
  { url: "https://feeds.reuters.com/reuters/topNews",                       source: "Reuters",           tag: "Breaking", bias: "C"   },
  { url: "https://feeds.bbci.co.uk/news/rss.xml",                          source: "BBC News",          tag: "Breaking", bias: "C-L" },
  { url: "https://apnews.com/rss",                                         source: "AP News",           tag: "Breaking", bias: "C"   },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",      source: "NY Times",          tag: "Breaking", bias: "C-L" },

  // Politics
  { url: "https://feeds.npr.org/1001/rss.xml",                              source: "NPR",               tag: "Politics", bias: "C-L" },
  { url: "https://rss.politico.com/politics-news.xml",                      source: "Politico",          tag: "Politics", bias: "C-L" },
  { url: "https://thehill.com/feed/",                                       source: "The Hill",          tag: "Politics", bias: "C"   },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml",                    source: "BBC World",         tag: "Politics", bias: "C-L" },
  { url: "https://feeds.npr.org/1004/rss.xml",                             source: "NPR Politics",      tag: "Politics", bias: "C-L" },
  { url: "https://www.tampabay.com/feed/",                                 source: "Tampa Bay Times",   tag: "Politics", bias: "C"   },

  // AI — category-specific only, no generic site feeds
  { url: "https://venturebeat.com/category/ai/feed/",                      source: "VentureBeat AI",    tag: "AI",       bias: "C"   },
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/",  source: "TechCrunch AI",     tag: "AI",       bias: "C-L" },
  { url: "https://www.technologyreview.com/feed/",                         source: "MIT Tech Review",   tag: "AI",       bias: "C"   },
  { url: "https://www.wired.com/feed/tag/artificial-intelligence/rss",     source: "Wired AI",          tag: "AI",       bias: "C-L" },
  { url: "https://www.artificialintelligence-news.com/feed/",              source: "AI News",           tag: "AI",       bias: "C"   },

  // Tech — curated, high-signal sources only (no generic Verge/Wired/TC site RSS)
  { url: "https://arstechnica.com/feed/",                                  source: "Ars Technica",      tag: "Tech",     bias: "C"   },
  { url: "https://techcrunch.com/startups/feed/",                          source: "TechCrunch Startups",tag: "Tech",    bias: "C-L" },
  { url: "https://techcrunch.com/venture/feed/",                           source: "TechCrunch VC",     tag: "Tech",     bias: "C-L" },
  { url: "https://arstechnica.com/gadgets/feed/",                          source: "Ars Gadgets",       tag: "Tech",     bias: "C"   },
];

const BREAKING_KEYWORDS = [
  "breaking", "urgent", "just in", "alert", "developing", "live updates",
  "emergency", "crisis", "killed", "dead", "explosion", "attack", "shooting",
  "earthquake", "hurricane", "indicted", "arrested", "sanctions", "declares war",
  "collapses", "defaulted", "banned",
];

// Patterns that indicate low-quality / irrelevant content
const SLOP_PATTERNS = [
  /\b(coupon|promo.?code|\d+%.?off|\$\d+.?off|discount|deal of the day|sale ends|shop now|buy now|best buy|gift card|black friday|cyber monday)\b/i,
  /\b(product review|buying guide|gift guide|hands.?on review|unboxing|first look review)\b/i,
  /^(review:|the \d+ best|best \d+|top \d+ (products|gadgets|apps|tools)|how to buy|where to buy)/i,
  /\b(sponsored|partner content|advertorial|affiliate)\b/i,
  /\b(giveaway|win a|enter to win)\b/i,
];

// Max's profile — what he actually cares about, used to score relevance
const MAX_INTERESTS = [
  { pattern: /\b(ai|artificial intelligence|llm|large language model|claude|gpt|openai|anthropic|gemini|agent|copilot|chatgpt|foundation model|generative|transformer)\b/i, score: 6 },
  { pattern: /\b(bitcoin|btc|xrp|ripple|crypto|blockchain|defi|coinbase|binance|ethereum|solana|token|nft|web3)\b/i, score: 6 },
  { pattern: /\b(startup|entrepreneur|founder|venture capital|vc|series [a-c]|fundrais|unicorn|ipo|exit|acquisition)\b/i, score: 5 },
  { pattern: /\b(sales|account manager|crm|salesforce|revenue|quota|pipeline|b2b|saas|go.?to.?market|gtm)\b/i, score: 5 },
  { pattern: /\b(stock market|s&p 500|nasdaq|dow jones|fed|federal reserve|interest rate|inflation|recession|earnings|gdp)\b/i, score: 4 },
  { pattern: /\b(investing|investment|portfolio|roth ira|401k|etf|dividend|compound interest|wealth|net worth|personal finance)\b/i, score: 4 },
  { pattern: /\b(florida|orlando|miami|tampa|tallahassee|desantis)\b/i, score: 3 },
  { pattern: /\b(software|developer|programming|open.?source|github|api|cloud|data center|semiconductor|chip|nvidia|apple|google|microsoft|meta|amazon)\b/i, score: 2 },
  { pattern: /\b(automation|robotics|autonomous|self.?driving|drone)\b/i, score: 2 },
];

// Low-importance patterns — down-rank these
const LOW_IMPORTANCE = [
  /\b(celebrity|kardashian|taylor swift|nba|nfl|mlb|super bowl|oscars|grammy|emmys|golden globe)\b/i,
  /\b(recipe|food|restaurant|diet|workout tip|fitness hack|skincare|fashion|beauty)\b/i,
  /\b(horoscope|zodiac|astrology)\b/i,
];

function stripHtml(html: string): string {
  return html?.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim().slice(0, 220) ?? "";
}

function isBreaking(title: string): boolean {
  const t = title.toLowerCase();
  return BREAKING_KEYWORDS.some(k => t.includes(k));
}

function isSlop(title: string, snippet: string): boolean {
  const text = title + " " + snippet;
  return SLOP_PATTERNS.some(p => p.test(text));
}

function scoreRelevance(title: string, snippet: string): number {
  const text = title + " " + (snippet ?? "");
  let score = 0;
  for (const { pattern, score: pts } of MAX_INTERESTS) {
    if (pattern.test(text)) score += pts;
  }
  for (const pattern of LOW_IMPORTANCE) {
    if (pattern.test(text)) score -= 4;
  }
  return score;
}

function recencyBoost(pubDate: string): number {
  const hoursAgo = (Date.now() - new Date(pubDate).getTime()) / 3600000;
  if (hoursAgo < 2)  return 8;
  if (hoursAgo < 6)  return 6;
  if (hoursAgo < 12) return 4;
  if (hoursAgo < 24) return 2;
  return 0;
}

export async function fetchNews(count = 200): Promise<NewsItem[]> {
  const parser = new Parser({ timeout: 8000 });
  const items: NewsItem[] = [];

  await Promise.allSettled(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        for (const item of parsed.items.slice(0, 10)) {
          const title   = item.title ?? "";
          const snippet = stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? "");
          const pubDate = item.pubDate ?? new Date().toISOString();

          if (title.length < 12) continue;
          if (isSlop(title, snippet)) continue;

          const relevance = scoreRelevance(title, snippet) + recencyBoost(pubDate);

          items.push({
            title,
            link:     item.link ?? "",
            source:   feed.source,
            tag:      feed.tag,
            bias:     feed.bias,
            pubDate,
            snippet,
            breaking: isBreaking(title),
            relevance,
          });
        }
      } catch {
        // Feed failed silently
      }
    })
  );

  // Deduplicate by headline
  const seen = new Set<string>();
  const deduped = items.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 55);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by combined relevance + recency score (descending)
  return deduped
    .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
    .slice(0, count);
}
