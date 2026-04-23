export interface RedditPost {
  title: string;
  subreddit: string;
  score: number;
  numComments: number;
  url: string;
  selftext?: string;
  author: string;
  created: number;
}

export async function searchReddit(
  query: string,
  subreddit?: string,
  limit = 5,
): Promise<{ posts: RedditPost[]; error?: string }> {
  try {
    const base = subreddit
      ? `https://www.reddit.com/r/${subreddit}/search.json`
      : "https://www.reddit.com/search.json";
    const params = new URLSearchParams({ q: query, sort: "relevance", limit: String(limit), restrict_sr: subreddit ? "1" : "0" });

    const res = await fetch(`${base}?${params}`, {
      headers: { "User-Agent": "MAX-Assistant/1.0 (personal-ai-system)" },
    });
    if (!res.ok) return { posts: [], error: `Reddit error ${res.status}` };
    const data = await res.json();

    const posts: RedditPost[] = (data.data?.children ?? []).map((c: { data: Record<string, unknown> }) => ({
      title: c.data.title as string,
      subreddit: c.data.subreddit as string,
      score: c.data.score as number,
      numComments: c.data.num_comments as number,
      url: `https://reddit.com${c.data.permalink as string}`,
      selftext: ((c.data.selftext as string) ?? "").slice(0, 300) || undefined,
      author: c.data.author as string,
      created: c.data.created_utc as number,
    }));

    return { posts };
  } catch (err) {
    return { posts: [], error: String(err) };
  }
}
