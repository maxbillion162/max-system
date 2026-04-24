/**
 * Unified notification pipeline.
 *
 * Use this ONLY for things that belong in Max's notification history —
 * alerts, reminders, proactive insights, confirmation requests.
 *
 * Do NOT use this for conversational Telegram replies, mid-conversation
 * tool output, or chatbot responses. Those stay on the direct
 * sendNotification() path in src/app/api/telegram/route.ts.
 *
 * Every call is gated by user opt-in (settings.notification_prefs).
 * Nothing ships unless explicitly enabled, except forceDeliver=true
 * (reserved for Tier-3 confirmation requests that must always reach Max).
 */

import { createClient } from "@supabase/supabase-js";

/* ─── Opt-in keys (match Settings toggles) ───
   Any new category needs a key here + a toggle in the Settings rebuild. */
export type NotifyCategory =
  | "bill_alerts"
  | "budget_alerts"
  | "habit_nudge"
  | "goal_milestone"
  | "goal_checkin"
  | "calendar_alerts"
  | "market_update"
  | "max_insight"        // Tier 2 proactive insights
  | "confirmation"       // Tier 3 approval requests (usually forceDeliver=true)
  | "weekly_recap"
  | "evening_checkin";

/* ─── Display type for the notifications table (icon/color mapping) ───
   Keeps notify() backward-compatible with NotificationBell's TYPE_CONFIG. */
export type NotifyDisplayType =
  | "crypto_alert"
  | "habit_reminder"
  | "bill_due"
  | "calendar_reminder"
  | "max_action"
  | "budget_alert"
  | "goal_milestone"
  | "general";

const CATEGORY_TO_DISPLAY: Record<NotifyCategory, NotifyDisplayType> = {
  bill_alerts:      "bill_due",
  budget_alerts:    "budget_alert",
  habit_nudge:      "habit_reminder",
  goal_milestone:   "goal_milestone",
  goal_checkin:     "goal_milestone",
  calendar_alerts:  "calendar_reminder",
  market_update:    "crypto_alert",
  max_insight:      "max_action",
  confirmation:     "max_action",
  weekly_recap:     "max_action",
  evening_checkin:  "max_action",
};

export interface NotifyParams {
  category:     NotifyCategory;
  title:        string;        // Bell inbox title (short)
  body:         string;        // Bell inbox body (plain text, 1-2 sentences)
  actionUrl?:   string;        // Optional deep-link when bell item is clicked
  telegramText?: string;       // Override Telegram message body (supports Markdown). Falls back to *title*\n\nbody
  displayType?: NotifyDisplayType;  // Override icon/color in bell
  forceDeliver?: boolean;      // Bypass opt-in (reserved for Tier-3 confirmations)
}

export interface NotifyResult {
  delivered: boolean;
  bellWritten: boolean;
  telegramSent: boolean;
  reason?: string;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Check whether the user has opted into a category.
 * Safe to call anywhere — single DB read. Cache not worth it at this scale.
 */
export async function isOptedIn(category: NotifyCategory): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "notification_prefs")
    .single();
  const prefs = (data?.value ?? {}) as Record<string, boolean>;
  return prefs[category] === true;
}

/**
 * Deliver a notification through the unified pipeline.
 * - Writes to the notifications table (dashboard bell + realtime toast) if opted in
 * - Simultaneously fires a Telegram push (same opt-in gate, unless forceDeliver)
 * - Returns a result object so callers can log/branch on partial failures
 */
export async function notify(params: NotifyParams): Promise<NotifyResult> {
  const optedIn = params.forceDeliver === true || (await isOptedIn(params.category));
  if (!optedIn) {
    return { delivered: false, bellWritten: false, telegramSent: false, reason: "not opted in" };
  }

  const supabase = getSupabase();
  const displayType = params.displayType ?? CATEGORY_TO_DISPLAY[params.category] ?? "general";

  // 1. Bell inbox
  let bellWritten = false;
  try {
    const { error } = await supabase.from("notifications").insert({
      type:       displayType,
      title:      params.title,
      body:       params.body,
      read:       false,
      action_url: params.actionUrl ?? null,
    });
    bellWritten = !error;
  } catch {
    bellWritten = false;
  }

  // 2. Telegram push
  let telegramSent = false;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  if (BOT_TOKEN && CHAT_ID) {
    const text = params.telegramText ?? `*${params.title}*\n\n${params.body}`;
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" }),
      });
      telegramSent = res.ok;
    } catch {
      telegramSent = false;
    }
  }

  return { delivered: bellWritten || telegramSent, bellWritten, telegramSent };
}
