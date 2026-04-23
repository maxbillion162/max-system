export async function wolframQuery(query: string): Promise<{ answer: string; error?: string }> {
  const appId = process.env.WOLFRAM_APP_ID;
  if (!appId) return { answer: "", error: "Wolfram Alpha not configured — add WOLFRAM_APP_ID" };

  try {
    const params = new URLSearchParams({ appid: appId, i: query, output: "plaintext" });
    const res = await fetch(`https://api.wolframalpha.com/v1/result?${params}`);
    if (!res.ok) {
      if (res.status === 501) return { answer: "", error: "Wolfram couldn't understand that query" };
      return { answer: "", error: `Wolfram error ${res.status}` };
    }
    const answer = await res.text();
    return { answer: answer.trim() };
  } catch (err) {
    return { answer: "", error: String(err) };
  }
}
