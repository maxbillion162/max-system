"use client";

import { useState } from "react";
import type { EmailClassification, EmailIntel } from "./types";
import { CLASSIFICATION_META, MONO } from "./types";

interface Props {
  thread:    EmailIntel;
  onClose:   () => void;
  onSubmit:  (newClass: EmailClassification, makeRule: boolean, ruleSpec?: { type: "sender_email" | "sender_domain" | "subject_contains"; value: string; name: string }) => Promise<void>;
}

export function ReclassifyMenu({ thread, onClose, onSubmit }: Props) {
  const [pick, setPick]               = useState<EmailClassification | null>(null);
  const [makeRule, setMakeRule]       = useState(true);
  const [ruleType, setRuleType]       = useState<"sender_email" | "sender_domain" | "subject_contains">("sender_email");
  const [submitting, setSubmitting]   = useState(false);

  const senderEmail  = (thread.sender_email ?? "").toLowerCase();
  const senderDomain = senderEmail.split("@")[1] ?? "";
  const subject      = thread.subject ?? "";

  const ruleValue =
    ruleType === "sender_email"     ? senderEmail
    : ruleType === "sender_domain"  ? senderDomain
    : subject;

  const rulePreview =
    ruleType === "sender_email"     ? `From: ${senderEmail}`
    : ruleType === "sender_domain"  ? `Anyone @${senderDomain}`
    : `Subject contains: "${subject}"`;

  async function submit() {
    if (!pick) return;
    setSubmitting(true);
    try {
      const ruleSpec = makeRule && ruleValue
        ? {
            type:  ruleType,
            value: ruleValue,
            name:  ruleType === "sender_email"  ? `${senderEmail} → ${pick}`
                 : ruleType === "sender_domain" ? `@${senderDomain} → ${pick}`
                 : `"${subject.slice(0, 30)}" → ${pick}`,
          }
        : undefined;
      await onSubmit(pick, makeRule, ruleSpec);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 220,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
        border: "1px solid var(--blue-border)",
        borderRadius: 3, width: "min(440px, 92vw)",
        padding: "18px 20px",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            RECLASSIFY THIS THREAD
          </span>
          <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, lineHeight: 1.5 }}>
            M.A.X. classified this as{" "}
            <span style={{ color: thread.classification ? CLASSIFICATION_META[thread.classification].color : "var(--t3)", fontFamily: MONO, letterSpacing: "0.16em" }}>
              {thread.classification ? CLASSIFICATION_META[thread.classification].label : "?"}
            </span>
            . What should it be?
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(["action", "waiting", "fyi", "newsletter", "noise"] as EmailClassification[]).map(c => {
            const meta = CLASSIFICATION_META[c];
            const on = pick === c;
            return (
              <button key={c} onClick={() => setPick(c)} style={{
                background: on ? meta.bg : "transparent",
                border: `1px solid ${on ? meta.color + "55" : "var(--border)"}`,
                borderLeft: `3px solid ${on ? meta.color : "transparent"}`,
                color: on ? meta.color : "var(--t2)",
                padding: "8px 12px", borderRadius: 2,
                fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", fontWeight: 700,
                textAlign: "left", cursor: "pointer",
              }}>
                {meta.label}
                <p style={{ fontSize: 9, color: on ? meta.color : "var(--t4)", marginTop: 3, fontWeight: 400, letterSpacing: 0 }}>
                  {meta.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Rule maker */}
        <div style={{
          padding: "10px 12px",
          background: makeRule ? "rgba(125,184,232,0.04)" : "transparent",
          border: "1px solid var(--border)", borderRadius: 2,
          opacity: pick ? 1 : 0.45,
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: pick ? "pointer" : "default" }}>
            <input type="checkbox" checked={makeRule} disabled={!pick} onChange={e => setMakeRule(e.target.checked)}
              style={{ accentColor: "#7DB8E8", cursor: pick ? "pointer" : "default" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--t1)", fontFamily: MONO, letterSpacing: "0.18em" }}>
              ALSO TEACH M.A.X. — MAKE THIS A RULE
            </span>
          </label>
          {makeRule && pick && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 9, color: "var(--t3)", letterSpacing: "0.18em", fontFamily: MONO, marginBottom: 6 }}>WHEN…</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {(["sender_email", "sender_domain", "subject_contains"] as const).map(rt => {
                  const on = ruleType === rt;
                  const label = rt === "sender_email"     ? `From this exact sender (${senderEmail})`
                              : rt === "sender_domain"   ? `From anyone @${senderDomain}`
                              : `Subject contains "${subject.slice(0, 40)}"`;
                  return (
                    <label key={rt} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "5px 8px", borderRadius: 2,
                      background: on ? "rgba(125,184,232,0.06)" : "transparent",
                      border: `1px solid ${on ? "var(--blue-border)" : "transparent"}`,
                      cursor: "pointer",
                      fontSize: 11, color: on ? "var(--t1)" : "var(--t3)",
                    }}>
                      <input type="radio" name="ruleType" checked={on} onChange={() => setRuleType(rt)}
                        style={{ accentColor: "#7DB8E8" }} />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
              <p style={{ marginTop: 8, fontSize: 10, color: "var(--blue)", fontFamily: MONO, letterSpacing: "0.06em" }}>
                ↳ {rulePreview} → <span style={{ color: pick ? CLASSIFICATION_META[pick].color : "var(--t3)" }}>{CLASSIFICATION_META[pick].label}</span>
              </p>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)",
            padding: "9px 0", borderRadius: 2,
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700, cursor: "pointer",
          }}>CANCEL</button>
          <button onClick={submit} disabled={!pick || submitting} style={{
            flex: 2, background: pick ? "var(--blue-dim)" : "transparent",
            border: `1px solid ${pick ? "var(--blue-border)" : "var(--border)"}`,
            color: pick ? "var(--blue)" : "var(--t4)",
            padding: "9px 0", borderRadius: 2,
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700,
            cursor: !pick || submitting ? "default" : "pointer", opacity: submitting ? 0.5 : 1,
          }}>{submitting ? "SAVING…" : "✓ APPLY"}</button>
        </div>
      </div>
    </div>
  );
}
