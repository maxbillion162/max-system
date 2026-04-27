/**
 * Shared types for the email surface.
 */

export type EmailClassification = "action" | "waiting" | "newsletter" | "fyi" | "noise";

export interface EmailIntel {
  thread_id:                 string;
  classification:            EmailClassification | null;
  classification_source:     "rule" | "ai" | "manual";
  classification_confidence: number | null;
  summary:                   string | null;
  why_important:             string | null;
  action_required:           boolean;
  action_reason:             string | null;
  importance_score:          number;
  snooze_until:              string | null;
  archived:                  boolean;
  starred:                   boolean;
  last_message_at:           string | null;
  generated_at:              string;
  subject:                   string | null;
  sender_name:               string | null;
  sender_email:              string | null;
  preview:                   string | null;
  unread:                    boolean;
}

export interface ThreadMessage {
  id:         string;
  message_id: string;
  from:       string;
  to:         string;
  cc:         string;
  subject:    string;
  date:       string;
  snippet:    string;
  body:       string;
  labels:     string[];
}

export interface EmailRule {
  id:                    string;
  name:                  string;
  condition_type:        "sender_email" | "sender_domain" | "subject_contains" | "body_contains" | "has_label";
  condition_value:       string;
  action_classification: EmailClassification;
  priority:              number;
  active:                boolean;
  hit_count:             number;
  last_hit_at:           string | null;
  created_at:            string;
  source:                "manual" | "feedback";
}

export interface BriefingItem {
  thread_id: string;
  subject:   string;
  sender:    string;
  rank:      number;
  reason:    string;
}

export interface Briefing {
  generated_at:  string;
  intro:         string;
  items:         BriefingItem[];
  reasoning:     string;
  total_unread:  number;
  action_count:  number;
  waiting_count: number;
}

export const CLASSIFICATION_META: Record<EmailClassification, { label: string; color: string; bg: string; description: string; }> = {
  action:     { label: "ACTION",     color: "var(--red)",   bg: "rgba(200,90,90,0.10)",  description: "Needs Max to do something" },
  waiting:    { label: "WAITING",    color: "#B89A6E",      bg: "rgba(184,154,110,0.10)", description: "Waiting on someone else" },
  newsletter: { label: "NEWSLETTER", color: "var(--blue)",  bg: "rgba(125,184,232,0.10)", description: "Subscribed content" },
  fyi:        { label: "FYI",        color: "var(--green)", bg: "rgba(95,176,125,0.10)",  description: "Informational, no action" },
  noise:      { label: "NOISE",      color: "var(--t4)",    bg: "rgba(255,255,255,0.04)", description: "Promotional / low-value" },
};

export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export function parseSenderField(from: string): { name: string; email: string } {
  const m = from.match(/^(.*?)\s*<(.+?)>$/);
  if (m) return { name: m[1].replace(/"/g, "").trim() || m[2], email: m[2] };
  return { name: from, email: from };
}

export function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7)  return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
