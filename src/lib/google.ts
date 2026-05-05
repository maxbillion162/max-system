import { google } from "googleapis";
import { supabase } from "@/lib/supabase";
import { encrypt, decrypt } from "@/lib/encryption";
export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(state?: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });
}

export async function getStoredTokens() {
  const { data } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", "max")
    .single();
  if (!data) return null;
  return {
    ...data,
    access_token: decrypt(data.access_token) ?? "",
    refresh_token: data.refresh_token ? decrypt(data.refresh_token) : data.refresh_token,
  };
}

export async function storeTokens(tokens: {
  access_token: string;
  refresh_token?: string | null;
  expiry_date?: number | null;
}) {
  await supabase.from("google_tokens").upsert({
    user_id: "max",
    access_token: encrypt(tokens.access_token),
    refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
}

export async function getAuthenticatedClient() {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  const client = getOAuthClient();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  // Auto-refresh if expired
  client.on("tokens", async (newTokens) => {
    await storeTokens({
      access_token: newTokens.access_token ?? tokens.access_token,
      refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
      expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
    });
  });

  return client;
}
