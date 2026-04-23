export async function browseUrl(url: string): Promise<{ content: string; title?: string; error?: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { content: "", error: "Firecrawl not configured — add FIRECRAWL_API_KEY" };

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) return { content: "", error: `Firecrawl error ${res.status}` };
    const data = await res.json();
    const content = (data.data?.markdown ?? data.data?.content ?? "").slice(0, 6000);
    const title   = data.data?.metadata?.title ?? undefined;
    return { content, title };
  } catch (err) {
    return { content: "", error: String(err) };
  }
}
