/**
 * Tier-3 confirmation flow.
 *
 * When the agent calls a Tier-3 tool (create_calendar_event, send_sms,
 * update_wealth, delete_*), the executor in max-agent.ts routes it
 * through enqueuePendingAction() instead of running it directly.
 *
 * That function:
 *  1. Inserts a row in pending_actions (status='pending')
 *  2. Sends Max a Telegram card with inline ✓ / ✗ buttons
 *     (callback_data = "pa:approve:<id>" / "pa:reject:<id>")
 *  3. Stores the resulting telegram_message_id on the row so the
 *     callback handler can edit it after approval/rejection
 *
 * The Telegram webhook (src/app/api/telegram/route.ts) handles the
 * callback_query and calls resolvePendingAction(id, decision).
 */

import { createClient } from "@supabase/supabase-js";
import {
  createCalendarEvent,
  sendSms,
  updateWealth,
  deleteHabit,
  deleteTask,
  deleteGoal,
  sendEmail,
} from "@/lib/max-tools";

/* ─── Tier-3 tool registry ─────────────────────────────────────── */
export const TIER_3_TOOLS = new Set([
  "create_calendar_event",
  "send_sms",
  "update_wealth",
  "delete_habit",
  "delete_task",
  "delete_goal",
  "delete_memory",
  "send_email",   // P4 — real Gmail send. Auto-send forbidden by CLAUDE.md, so always Tier-3.
]);

/* ─── Supabase ─────────────────────────────────────────────────── */
function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

/* ─── Public API ───────────────────────────────────────────────── */

export interface EnqueueParams {
  tool_name:   string;
  tool_input:  Record<string, unknown>;
  description: string;       // human-readable summary for Max
  surface?:    string;       // 'web' | 'bubble' | 'telegram'
  requested_by?: "agent" | "max" | "cron";
}

export interface PendingActionRow {
  id:                   string;
  tool_name:            string;
  tool_input:           Record<string, unknown>;
  description:          string;
  status:               "pending" | "approved" | "rejected" | "executed" | "expired" | "failed";
  result:               string | null;
  telegram_message_id:  number | null;
  created_at:           string;
}

/**
 * Queue a Tier-3 action and ping Max on Telegram for approval.
 * Returns the pending row's id so the caller can reference it in their
 * agent reply ("Queued for your approval — check Telegram").
 */
export async function enqueuePendingAction(p: EnqueueParams): Promise<{ id: string | null; delivered: boolean; reason?: string }> {
  const supabase = sb();

  // 1. Insert pending row
  const { data: row, error } = await supabase
    .from("pending_actions")
    .insert({
      tool_name:    p.tool_name,
      tool_input:   p.tool_input,
      description:  p.description,
      surface:      p.surface ?? null,
      requested_by: p.requested_by ?? "agent",
      status:       "pending",
    })
    .select("id")
    .single();

  if (error || !row?.id) {
    return { id: null, delivered: false, reason: error?.message ?? "insert failed" };
  }

  // 2. Send Telegram card with inline ✓ / ✗ buttons
  let messageId: number | null = null;
  if (BOT_TOKEN && CHAT_ID) {
    try {
      const text = [
        "🔒 *Confirmation Needed*",
        "",
        p.description,
        "",
        "_Approve or reject below._",
      ].join("\n");

      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✓ Approve", callback_data: `pa:approve:${row.id}` },
              { text: "✗ Reject",  callback_data: `pa:reject:${row.id}`  },
            ]],
          },
        }),
      });
      const json = await res.json().catch(() => null);
      if (json?.ok && json?.result?.message_id) {
        messageId = json.result.message_id as number;
        await supabase
          .from("pending_actions")
          .update({ telegram_message_id: messageId })
          .eq("id", row.id);
      }
    } catch {
      /* non-fatal — row still exists, can be approved manually later */
    }
  }

  return { id: row.id, delivered: messageId !== null };
}

/**
 * Execute a Tier-3 tool that's already been approved.
 * Returns a short string describing the outcome (used for receipts).
 */
async function runTier3Tool(name: string, input: Record<string, unknown>): Promise<{ ok: boolean; result: string }> {
  try {
    switch (name) {
      case "create_calendar_event": {
        const r = await createCalendarEvent(
          input.title as string,
          input.start as string,
          input.end as string,
          (input.description as string) ?? "",
          (input.location as string) ?? "",
        );
        const errMsg = (r as { error?: string })?.error;
        if (errMsg) return { ok: false, result: errMsg };
        return { ok: true, result: `Event created: ${input.title}` };
      }
      case "send_sms": {
        const r = await sendSms(input.message as string);
        const errMsg = (r as { error?: string })?.error;
        if (errMsg) return { ok: false, result: errMsg };
        return { ok: true, result: "SMS sent" };
      }
      case "update_wealth": {
        await updateWealth(input as Parameters<typeof updateWealth>[0]);
        return { ok: true, result: "Wealth updated" };
      }
      case "delete_habit": {
        await deleteHabit(input.id as string);
        return { ok: true, result: "Habit deleted" };
      }
      case "delete_task": {
        await deleteTask(input.id as string);
        return { ok: true, result: "Task deleted" };
      }
      case "delete_goal": {
        await deleteGoal(input.id as string);
        return { ok: true, result: "Goal deleted" };
      }
      case "send_email": {
        const r = await sendEmail({
          to:        input.to as string,
          subject:   input.subject as string,
          body:      input.body as string,
          threadId:  input.threadId  as string | undefined,
          inReplyTo: input.inReplyTo as string | undefined,
          cc:        input.cc        as string | undefined,
          bcc:       input.bcc       as string | undefined,
        });
        const errMsg = (r as { error?: string })?.error;
        if (errMsg) return { ok: false, result: errMsg };
        return { ok: true, result: `Sent to ${input.to}` };
      }
      default:
        return { ok: false, result: `Unknown Tier-3 tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, result: String(err) };
  }
}

/**
 * Resolve a pending action — called from the Telegram callback_query handler.
 * Edits the original Telegram message to reflect the outcome (no buttons).
 */
export async function resolvePendingAction(
  id: string,
  decision: "approve" | "reject",
): Promise<{ ok: boolean; outcome: string }> {
  const supabase = sb();

  // Fetch the row
  const { data: row, error } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("id", id)
    .single<PendingActionRow>();

  if (error || !row) return { ok: false, outcome: "Not found" };
  if (row.status !== "pending") {
    return { ok: false, outcome: `Already ${row.status}` };
  }

  let finalStatus: "executed" | "rejected" | "failed" = "rejected";
  let outcome = "Rejected";

  if (decision === "approve") {
    const exec = await runTier3Tool(row.tool_name, row.tool_input);
    if (exec.ok) {
      finalStatus = "executed";
      outcome = exec.result;
    } else {
      finalStatus = "failed";
      outcome = exec.result;
    }
  }

  await supabase
    .from("pending_actions")
    .update({ status: finalStatus, result: outcome, resolved_at: new Date().toISOString() })
    .eq("id", id);

  // Edit the original message to remove buttons + show outcome
  if (BOT_TOKEN && CHAT_ID && row.telegram_message_id) {
    const symbol = finalStatus === "executed" ? "✅"
                 : finalStatus === "rejected" ? "✗"
                 : "⚠️";
    const headerWord = finalStatus === "executed" ? "Approved · Executed"
                     : finalStatus === "rejected" ? "Rejected"
                     : "Failed";
    const text = [
      `${symbol} *${headerWord}*`,
      "",
      row.description,
      "",
      `_${outcome}_`,
    ].join("\n");

    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          chat_id:    CHAT_ID,
          message_id: row.telegram_message_id,
          text,
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [] },
        }),
      });
    } catch {
      /* non-fatal */
    }
  }

  return { ok: finalStatus === "executed" || finalStatus === "rejected", outcome };
}

/**
 * Acknowledge the inline button press immediately (Telegram requires this
 * within ~10s or the user sees a spinner forever).
 */
export async function answerCallbackQuery(callback_query_id: string, text?: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ callback_query_id, text: text ?? "" }),
    });
  } catch {
    /* non-fatal */
  }
}
