import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REDIRECT_URI  = process.env.SPOTIFY_REDIRECT_URI ?? "https://max-system-dusky.vercel.app/api/auth/spotify/callback";

/* ── Token storage ── */
interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

async function getTokens(): Promise<SpotifyTokens | null> {
  const { data } = await sb.from("settings").select("value").eq("key", "spotify_tokens").single();
  return data ? (data.value as SpotifyTokens) : null;
}

async function saveTokens(tokens: SpotifyTokens) {
  await sb.from("settings").upsert({ key: "spotify_tokens", value: tokens }, { onConflict: "key" });
}

async function refreshAccessToken(refresh_token: string): Promise<SpotifyTokens | null> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const tokens: SpotifyTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  await saveTokens(tokens);
  return tokens;
}

async function getValidToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens) return null;
  if (Date.now() > tokens.expires_at - 60_000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    return refreshed?.access_token ?? null;
  }
  return tokens.access_token;
}

/* ── OAuth helpers ── */
export function getAuthUrl(): string {
  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-read-private",
    "user-library-read",
  ].join(" ");
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: scopes,
    show_dialog: "false",
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
  });
  if (!res.ok) return { success: false, error: `Token exchange failed: ${res.status}` };
  const data = await res.json();
  await saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  });
  return { success: true };
}

/* ── Playback control ── */
async function spotifyApi(method: string, path: string, body?: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const token = await getValidToken();
  if (!token) return { ok: false, error: "Spotify not connected — authorize at /api/auth/spotify" };

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return { ok: true };
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { ok: false, error: `Spotify ${res.status}: ${err.slice(0, 200)}` };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, data };
}

export interface SpotifyTrack {
  name: string;
  artist: string;
  album: string;
  isPlaying: boolean;
  progressMs?: number;
  durationMs?: number;
  uri?: string;
}

export async function getCurrentTrack(): Promise<SpotifyTrack | { error: string } | null> {
  const res = await spotifyApi("GET", "/me/player/currently-playing");
  if (!res.ok) return { error: res.error ?? "Spotify error" };
  if (!res.data) return null;

  const d = res.data as Record<string, unknown>;
  const item = d.item as Record<string, unknown> | null;
  if (!item) return null;

  const artists = (item.artists as { name: string }[]) ?? [];
  return {
    name: item.name as string,
    artist: artists.map(a => a.name).join(", "),
    album: (item.album as { name: string })?.name ?? "",
    isPlaying: d.is_playing as boolean,
    progressMs: d.progress_ms as number,
    durationMs: item.duration_ms as number,
    uri: item.uri as string,
  };
}

export async function playback(action: "play" | "pause" | "next" | "previous"): Promise<{ success: boolean; error?: string }> {
  const endpoints: Record<string, [string, string]> = {
    play:     ["PUT",  "/me/player/play"],
    pause:    ["PUT",  "/me/player/pause"],
    next:     ["POST", "/me/player/next"],
    previous: ["POST", "/me/player/previous"],
  };
  const [method, path] = endpoints[action];
  const res = await spotifyApi(method, path);
  return res.ok ? { success: true } : { success: false, error: res.error };
}

export async function searchSpotify(query: string, type: "track" | "playlist" | "artist" = "track", limit = 5): Promise<{ results: unknown[]; error?: string }> {
  const params = new URLSearchParams({ q: query, type, limit: String(limit) });
  const res = await spotifyApi("GET", `/search?${params}`);
  if (!res.ok) return { results: [], error: res.error };

  const data = res.data as Record<string, unknown>;
  const items = (data[`${type}s`] as { items: unknown[] } | undefined)?.items ?? [];
  return { results: items };
}

export async function setVolume(percent: number): Promise<{ success: boolean; error?: string }> {
  const clamped = Math.max(0, Math.min(100, percent));
  const res = await spotifyApi("PUT", `/me/player/volume?volume_percent=${clamped}`);
  return res.ok ? { success: true } : { success: false, error: res.error };
}

export async function isConnected(): Promise<boolean> {
  const tokens = await getTokens();
  return !!tokens;
}
