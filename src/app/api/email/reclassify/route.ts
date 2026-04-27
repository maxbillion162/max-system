import { NextResponse } from "next/server";
import { sb } from "@/lib/email-intel";

/**
 * Reclassify — Max manually overrides a thread's classification AND
 * (optionally) creates a rule from it so the system actually learns.
 *
 * This is the load-bearing learning hook for the email system. When Max
 * thumbs-down a Claude-assigned classification, the UI opens a picker
 * with `make_rule: true` checked by default. The next email matching the
 * same condition will skip Claude entirely and apply the rule directly —
 * no more wrong-classification feedback on the same sender.
 *
 * POST {
 *   thread_id, new_classification,
 *   make_rule?: boolean,            (default false)
 *   rule_condition_type?: 'sender_email'|'sender_domain'|'subject_contains',
 *   rule_condition_value?: string,
 *   rule_name?: string,
 * }
 */

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      thread_id?:            string;
      new_classification?:   string;
      make_rule?:            boolean;
      rule_condition_type?:  string;
      rule_condition_value?: string;
      rule_name?:            string;
    };

    if (!body.thread_id || !body.new_classification) {
      return NextResponse.json({ error: "thread_id + new_classification required" }, { status: 400 });
    }
    const valid = ["action", "waiting", "newsletter", "fyi", "noise"];
    if (!valid.includes(body.new_classification)) {
      return NextResponse.json({ error: "invalid classification" }, { status: 400 });
    }

    const supabase = sb();

    /* 1. Update the intel row to manual */
    const { error: updErr } = await supabase
      .from("email_intel")
      .update({
        classification:            body.new_classification,
        classification_source:     "manual",
        classification_confidence: 1,
        action_required:           body.new_classification === "action",
      })
      .eq("thread_id", body.thread_id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    /* 2. Optionally write a rule */
    let ruleId: string | null = null;
    if (body.make_rule) {
      if (!body.rule_condition_type || !body.rule_condition_value) {
        return NextResponse.json({ error: "rule_condition_type + rule_condition_value required when make_rule=true" }, { status: 400 });
      }
      const validCond = ["sender_email", "sender_domain", "subject_contains", "body_contains", "has_label"];
      if (!validCond.includes(body.rule_condition_type)) {
        return NextResponse.json({ error: "invalid rule_condition_type" }, { status: 400 });
      }

      const name = body.rule_name?.trim() ||
        `${body.rule_condition_type.replace("_", " ")} ${body.rule_condition_value} → ${body.new_classification}`;

      const { data: ruleRow, error: ruleErr } = await supabase
        .from("email_rules")
        .insert({
          name,
          condition_type:        body.rule_condition_type,
          condition_value:       body.rule_condition_value,
          action_classification: body.new_classification,
          priority:              30,                // user-trained rules outrank defaults
          active:                true,
          source:                "feedback",
        })
        .select("id")
        .single();
      if (!ruleErr && ruleRow) ruleId = (ruleRow as { id: string }).id;

      /* 3. Re-apply this rule to OTHER existing intel rows that match,
         so retroactively classifying same-sender threads is automatic. */
      if (ruleId) {
        let q = supabase.from("email_intel").update({
          classification:            body.new_classification,
          classification_source:     "rule",
          classification_confidence: 1,
          action_required:           body.new_classification === "action",
        });
        if (body.rule_condition_type === "sender_email") {
          q = q.ilike("sender_email", body.rule_condition_value);
        } else if (body.rule_condition_type === "sender_domain") {
          q = q.ilike("sender_email", `%@${body.rule_condition_value}`);
        } else if (body.rule_condition_type === "subject_contains") {
          q = q.ilike("subject", `%${body.rule_condition_value}%`);
        }
        // body_contains / has_label not retroactively applied — they need the full body / label list which intel rows don't carry
        await q;
      }
    }

    return NextResponse.json({ ok: true, rule_id: ruleId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
