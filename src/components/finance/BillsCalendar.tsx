"use client";

import { useEffect, useMemo, useState } from "react";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

interface Bill {
  id?:            string;
  name:           string;
  amt:            number;
  due_day:        number;
  recurrence?:    "monthly" | "quarterly" | "annual" | "one-time" | "custom" | null;
  next_due_date?: string | null;
  category?:      string | null;
  active?:        boolean;
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/** Compute the date a bill is due in a given month/year. */
function billDateForMonth(b: Bill, year: number, month: number): Date | null {
  /* one-time + custom: only show on the explicit next_due_date */
  if (b.recurrence === "one-time" || b.recurrence === "custom") {
    if (!b.next_due_date) return null;
    const d = new Date(b.next_due_date + "T12:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) return d;
    return null;
  }

  /* annual: only show in the same calendar month as next_due_date */
  if (b.recurrence === "annual" && b.next_due_date) {
    const ref = new Date(b.next_due_date + "T12:00:00");
    if (ref.getMonth() !== month) return null;
    /* Use due_day for the day-of-month within that month/year */
  }

  /* quarterly: show every 3 months from next_due_date */
  if (b.recurrence === "quarterly" && b.next_due_date) {
    const ref = new Date(b.next_due_date + "T12:00:00");
    const monthsBetween = (year - ref.getFullYear()) * 12 + (month - ref.getMonth());
    if (monthsBetween < 0 || monthsBetween % 3 !== 0) return null;
  }

  /* default monthly: every month on due_day, capped to month length */
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(Math.max(1, b.due_day), lastDay);
  return new Date(year, month, day, 12, 0, 0);
}

interface Props {
  /** Optional prefilled bills — if omitted, the component fetches from supabase via /api/bills route... */
  bills?: Bill[];
  onEditBill?: (bill: Bill) => void;
}

export function BillsCalendar({ bills: propBills, onEditBill }: Props) {
  const [bills, setBills] = useState<Bill[]>(propBills ?? []);
  const [loading, setLoading] = useState(!propBills);
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  /* If parent didn't supply bills, pull them */
  useEffect(() => {
    if (propBills) { setBills(propBills); return; }
    let alive = true;
    (async () => {
      try {
        /* Tap supabase via the same channel the page uses */
        const res = await fetch("/api/bills");
        if (res.ok) {
          const j = await res.json();
          if (alive && Array.isArray(j.bills)) setBills(j.bills);
        }
      } catch { /* ignore — empty calendar is fine */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [propBills]);

  const billsByDay = useMemo(() => {
    const map: Record<string, Bill[]> = {};
    for (const b of bills) {
      if (b.active === false) continue;
      const d = billDateForMonth(b, cursor.year, cursor.month);
      if (!d) continue;
      const key = ymd(d);
      (map[key] ??= []).push(b);
    }
    return map;
  }, [bills, cursor]);

  /* Build the grid — leading blanks + days + trailing blanks to complete weeks */
  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

  const cells: { date: Date | null; key: string }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, key: `pad-l-${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(cursor.year, cursor.month, d), key: `d-${d}` });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, key: `pad-r-${cells.length}` });

  /* Weekly totals */
  const weekTotals: number[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const slice = cells.slice(i, i + 7);
    let total = 0;
    for (const c of slice) {
      if (!c.date) continue;
      const arr = billsByDay[ymd(c.date)] ?? [];
      total += arr.reduce((s, b) => s + b.amt, 0);
    }
    weekTotals.push(total);
  }

  const monthName = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthTotal = bills
    .filter(b => b.active !== false && billDateForMonth(b, cursor.year, cursor.month))
    .reduce((s, b) => s + b.amt, 0);

  function shift(delta: number) {
    setCursor(c => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.32em", color: "var(--blue)", fontFamily: MONO }}>
            BILLS CALENDAR
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 6 }}>
            <p style={{ fontSize: 22, fontWeight: 600, color: "var(--t1)", fontFamily: MONO, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {monthName.toUpperCase()}
            </p>
            <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: MONO, letterSpacing: "0.06em" }}>
              · {fmtUsd(monthTotal)} TOTAL
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => shift(-1)} style={navBtn()}>‹</button>
          <button onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })} style={navBtn(true)}>TODAY</button>
          <button onClick={() => shift(1)} style={navBtn()}>›</button>
        </div>
      </div>

      {loading ? (
        <p style={{ padding: "30px 20px", textAlign: "center", color: "var(--t4)", fontFamily: MONO, fontSize: 11 }}>loading…</p>
      ) : (
        <>
          {/* Day-of-week header */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr) 64px",
            borderTop: "1px solid var(--border)",
            background: "rgba(125,184,232,0.03)",
          }}>
            {DAY_NAMES.map((d, i) => (
              <div key={i} style={{
                padding: "8px 0", textAlign: "center",
                fontSize: 9, color: "var(--t3)", letterSpacing: "0.18em", fontFamily: MONO,
                borderRight: "1px solid var(--border)",
              }}>{d}</div>
            ))}
            <div style={{ padding: "8px 0", textAlign: "center", fontSize: 9, color: "var(--blue)", letterSpacing: "0.18em", fontFamily: MONO }}>
              WEEK
            </div>
          </div>

          {/* Grid rows */}
          {Array.from({ length: cells.length / 7 }, (_, weekIdx) => (
            <div key={weekIdx} style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr) 64px",
              borderTop: "1px solid var(--border)",
            }}>
              {cells.slice(weekIdx * 7, weekIdx * 7 + 7).map(c => {
                const isToday = c.date && ymd(c.date) === ymd(today);
                const dayBills = c.date ? (billsByDay[ymd(c.date)] ?? []) : [];
                return (
                  <div key={c.key} style={{
                    minHeight: 78, borderRight: "1px solid var(--border)",
                    padding: "6px 8px", position: "relative",
                    background: isToday ? "rgba(125,184,232,0.05)" : "transparent",
                  }}>
                    {c.date && (
                      <>
                        <div style={{
                          fontSize: 11, fontFamily: MONO, fontWeight: isToday ? 700 : 400,
                          color: isToday ? "var(--blue)" : "var(--t3)",
                          letterSpacing: "0.06em",
                        }}>
                          {c.date.getDate()}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                          {dayBills.map((b, i) => (
                            <button key={(b.id ?? b.name) + i}
                              onClick={() => onEditBill?.(b)}
                              title={`${b.name} · ${fmtUsd(b.amt)}`}
                              style={{
                                background: "rgba(125,184,232,0.08)",
                                border: "1px solid var(--blue-border)",
                                color: "var(--blue)",
                                padding: "2px 6px", borderRadius: 2,
                                fontSize: 9, fontFamily: MONO, letterSpacing: "0.06em",
                                textAlign: "left",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                cursor: onEditBill ? "pointer" : "default",
                              }}>
                              {b.name} · ${b.amt.toFixed(0)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {/* Week total */}
              <div style={{
                padding: "6px 10px", textAlign: "right",
                fontSize: 10, color: weekTotals[weekIdx] > 0 ? "var(--t2)" : "var(--t4)",
                fontFamily: MONO, letterSpacing: "0.06em",
              }}>
                {weekTotals[weekIdx] > 0 ? fmtUsd(weekTotals[weekIdx]) : "—"}
              </div>
            </div>
          ))}

          {/* Empty footnote */}
          {bills.filter(b => b.active !== false).length === 0 && (
            <p style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--t3)" }}>
              No bills configured yet. Add some to see them on the calendar.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function navBtn(active = false): React.CSSProperties {
  return {
    background: active ? "var(--blue-dim)" : "transparent",
    border: `1px solid ${active ? "var(--blue-border)" : "var(--border)"}`,
    color: active ? "var(--blue)" : "var(--t3)",
    padding: "5px 12px", borderRadius: 2,
    fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", cursor: "pointer", fontWeight: 700,
  };
}
