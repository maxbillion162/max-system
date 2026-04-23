"use client";

import { useState, useEffect, useMemo } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { supabase } from "@/lib/supabase";

/* ── Types ── */
interface BudgetAllocation {
  id: string;
  category: string;
  budgeted: number;
  period_start: string;
  rollover: boolean;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  merchant: string;
  merchant_normalized: string;
  category: string;
  budget_category: string | null;
  pending: boolean;
}

/* ── Constants ── */
const CATEGORY_COLORS: Record<string, string> = {
  Housing:        "#4589ff",
  Food:           "#10b981",
  Transport:      "#f59e0b",
  Entertainment:  "#8b5cf6",
  Subscriptions:  "#06b6d4",
  Savings:        "#10b981",
  Health:         "#ef4444",
  Shopping:       "#f97316",
  Personal:       "#ec4899",
  Investing:      "#6366f1",
  Misc:           "#6b7280",
};

const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS);

const QUICK_SETUP_DEFAULTS = [
  { category: "Housing",       budgeted: 950  },
  { category: "Food",          budgeted: 400  },
  { category: "Transport",     budgeted: 150  },
  { category: "Entertainment", budgeted: 100  },
  { category: "Subscriptions", budgeted: 75   },
  { category: "Savings",       budgeted: 200  },
  { category: "Health",        budgeted: 50   },
  { category: "Shopping",      budgeted: 100  },
  { category: "Personal",      budgeted: 80   },
  { category: "Investing",     budgeted: 100  },
  { category: "Misc",          budgeted: 50   },
];

/* ── Helpers ── */
function periodStart(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function periodLabel(p: string) {
  return new Date(p + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function nextPeriod(p: string) {
  const d = new Date(p + "T12:00:00");
  d.setMonth(d.getMonth() + 1);
  return periodStart(d);
}

function prevPeriodStr(p: string) {
  const d = new Date(p + "T12:00:00");
  d.setMonth(d.getMonth() - 1);
  return periodStart(d);
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/* ── Income edit modal ── */
function IncomeModal({ current, onSave, onClose }: { current: number; onSave: (n: number) => void; onClose: () => void }) {
  const [val, setVal] = useState(String(current || ""));
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "28px 32px", width: 360 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 20 }}>Monthly Income</h3>
        <div style={{ position: "relative", marginBottom: 24 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", fontFamily: "monospace", fontSize: 16 }}>$</span>
          <input
            type="number" autoFocus value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { onSave(parseFloat(val) || 0); onClose(); } if (e.key === "Escape") onClose(); }}
            style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 7, padding: "12px 12px 12px 28px", color: "var(--t1)", fontFamily: "monospace", fontSize: 18, fontWeight: 700, outline: "none" }}
            onFocus={e => e.target.style.borderColor = "var(--blue)"}
            onBlur={e => e.target.style.borderColor = "var(--border2)"}
          />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)" }}>Cancel</button>
          <button onClick={() => { onSave(parseFloat(val) || 0); onClose(); }} style={{ flex: 2, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.4)", color: "var(--blue)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ── Allocation add/edit modal ── */
function AllocationModal({ alloc, existingCategories, onSave, onDelete, onClose }: {
  alloc?: BudgetAllocation;
  existingCategories: string[];
  onSave: (category: string, budgeted: number, id?: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const available = ALL_CATEGORIES.filter(c => !existingCategories.includes(c) || c === alloc?.category);
  const [category, setCategory] = useState(alloc?.category ?? available[0] ?? "");
  const [budgeted, setBudgeted] = useState(String(alloc?.budgeted ?? ""));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "28px 32px", width: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{alloc ? "Edit Category" : "Add Category"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--t3)", display: "block", marginBottom: 6 }}>Category</label>
            <select
              value={category} onChange={e => setCategory(e.target.value)}
              disabled={!!alloc}
              style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "10px 12px", color: "var(--t1)", fontSize: 14, fontWeight: 600, outline: "none", cursor: alloc ? "default" : "pointer" }}
            >
              {available.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--t3)", display: "block", marginBottom: 6 }}>Monthly Budget</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", fontFamily: "monospace" }}>$</span>
              <input
                type="number" autoFocus value={budgeted} onChange={e => setBudgeted(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { onSave(category, parseFloat(budgeted) || 0, alloc?.id); } if (e.key === "Escape") onClose(); }}
                style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "10px 12px 10px 26px", color: "var(--t1)", fontFamily: "monospace", fontSize: 15, fontWeight: 700, outline: "none" }}
                onFocus={e => e.target.style.borderColor = "var(--blue)"}
                onBlur={e => e.target.style.borderColor = "var(--border2)"}
              />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {onDelete && (
            <button onClick={onDelete} style={{ padding: "11px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--red)" }}>Delete</button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)" }}>Cancel</button>
          <button onClick={() => onSave(category, parseFloat(budgeted) || 0, alloc?.id)} style={{ flex: 2, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.4)", color: "var(--blue)" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ── Categorize transaction modal ── */
function CategorizeModal({ tx, onSave, onClose }: {
  tx: Transaction;
  onSave: (tx: Transaction, category: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(tx.budget_category ?? tx.category ?? ALL_CATEGORIES[0]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "28px 32px", width: 420 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>Categorize Transaction</h3>
        <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20 }}>
          Rule saved for all future <span style={{ color: "var(--t2)", fontWeight: 600 }}>{tx.merchant}</span> transactions
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>{tx.merchant}</div>
            <div style={{ fontSize: 12, color: "var(--t4)", marginTop: 3 }}>{new Date(tx.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: "var(--red)" }}>-${fmt(tx.amount)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
          {ALL_CATEGORIES.map(cat => {
            const color = CATEGORY_COLORS[cat];
            const active = selected === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelected(cat)}
                style={{
                  padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: active ? `${color}18` : "var(--surface2)",
                  border: `1px solid ${active ? color + "50" : "var(--border)"}`,
                  color: active ? color : "var(--t3)",
                  textAlign: "left", transition: "all 0.1s",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
                {cat}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)" }}>Cancel</button>
          <button onClick={() => onSave(tx, selected)} style={{ flex: 2, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.4)", color: "var(--blue)" }}>Save Rule + Categorize All</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function BudgetPage() {
  const [allocations,   setAllocations]   = useState<BudgetAllocation[]>([]);
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [period,        setPeriod]        = useState(periodStart());
  const [modal,         setModal]         = useState<"income" | "add" | { type: "edit"; alloc: BudgetAllocation } | null>(null);
  const [reviewing,     setReviewing]     = useState<Transaction | null>(null);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => { loadData(); }, [period]);

  async function loadData() {
    setLoading(true);
    const [allocRes, txRes, incomeRes] = await Promise.allSettled([
      supabase.from("budget_allocations").select("*").eq("period_start", period).order("category"),
      supabase.from("transactions").select("*").gte("date", period).lt("date", nextPeriod(period)).order("date", { ascending: false }).limit(300),
      supabase.from("settings").select("value").eq("key", "monthly_income").single(),
    ]);

    if (allocRes.status === "fulfilled" && allocRes.value.data) setAllocations(allocRes.value.data);
    if (txRes.status === "fulfilled" && txRes.value.data) setTransactions(txRes.value.data as Transaction[]);
    if (incomeRes.status === "fulfilled" && incomeRes.value.data) {
      const raw = incomeRes.value.data.value;
      setMonthlyIncome(typeof raw === "number" ? raw : parseFloat(String(raw)) || 0);
    }
    setLoading(false);
  }

  /* Compute spending per category from transactions */
  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.pending || tx.amount <= 0) continue;
      const cat = tx.budget_category ?? tx.category ?? "Misc";
      map[cat] = (map[cat] ?? 0) + tx.amount;
    }
    return map;
  }, [transactions]);

  const totalBudgeted   = allocations.reduce((a, b) => a + b.budgeted, 0);
  const totalSpent      = Object.values(spendByCategory).reduce((a, b) => a + b, 0);
  const readyToAssign   = monthlyIncome - totalBudgeted;

  const needsReview = transactions.filter(tx =>
    !tx.pending && tx.amount > 0 &&
    (!tx.budget_category || tx.budget_category === "Uncategorized") &&
    (!tx.category || tx.category === "Uncategorized" || tx.category.startsWith("GENERAL") || tx.category === "OTHER")
  );

  /* Actions */
  async function quickSetup() {
    const rows = QUICK_SETUP_DEFAULTS.map(d => ({ ...d, period_start: period, rollover: false }));
    const { data } = await supabase.from("budget_allocations").upsert(rows, { onConflict: "category,period_start" }).select();
    if (data) setAllocations(data);
    await supabase.from("settings").upsert({ key: "monthly_income", value: 3000 });
    setMonthlyIncome(3000);
  }

  async function saveIncome(amount: number) {
    setMonthlyIncome(amount);
    await supabase.from("settings").upsert({ key: "monthly_income", value: amount });
  }

  async function saveAllocation(category: string, budgeted: number, id?: string) {
    if (id) {
      const { data } = await supabase.from("budget_allocations").update({ budgeted }).eq("id", id).select().single();
      if (data) setAllocations(prev => prev.map(a => a.id === id ? data : a));
    } else {
      const { data } = await supabase.from("budget_allocations").insert({ category, budgeted, period_start: period, rollover: false }).select().single();
      if (data) setAllocations(prev => [...prev, data].sort((a, b) => a.category.localeCompare(b.category)));
    }
    setModal(null);
  }

  async function deleteAllocation(id: string) {
    await supabase.from("budget_allocations").delete().eq("id", id);
    setAllocations(prev => prev.filter(a => a.id !== id));
    setModal(null);
  }

  async function categorizeTransaction(tx: Transaction, newCategory: string) {
    /* Save merchant rule */
    await supabase.from("merchant_rules").upsert({
      merchant_pattern: tx.merchant_normalized,
      category: newCategory,
      confirmed: true,
    }, { onConflict: "merchant_pattern" });

    /* Update all transactions from this merchant */
    await supabase.from("transactions")
      .update({ budget_category: newCategory })
      .eq("merchant_normalized", tx.merchant_normalized);

    setTransactions(prev => prev.map(t =>
      t.merchant_normalized === tx.merchant_normalized ? { ...t, budget_category: newCategory } : t
    ));
    setReviewing(null);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ fontSize: 12, color: "var(--t4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Loading budget…</div>
      </div>
    );
  }

  const spendingTx = transactions.filter(tx => tx.amount > 0 && !tx.pending);

  return (
    <div style={{ padding: "40px 52px", background: "var(--bg)", minHeight: "100vh" }}>
      {/* Modals */}
      {modal === "income" && <IncomeModal current={monthlyIncome} onSave={saveIncome} onClose={() => setModal(null)} />}
      {modal === "add" && (
        <AllocationModal
          existingCategories={allocations.map(a => a.category)}
          onSave={saveAllocation}
          onClose={() => setModal(null)}
        />
      )}
      {modal !== null && typeof modal === "object" && modal.type === "edit" && (
        <AllocationModal
          alloc={modal.alloc}
          existingCategories={allocations.map(a => a.category)}
          onSave={saveAllocation}
          onDelete={() => deleteAllocation(modal.alloc.id)}
          onClose={() => setModal(null)}
        />
      )}
      {reviewing && <CategorizeModal tx={reviewing} onSave={categorizeTransaction} onClose={() => setReviewing(null)} />}

      <div style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--blue)", opacity: 0.7, marginBottom: 8 }}>Zero-Based Budget</p>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em", marginBottom: 6 }}>Budget</h1>
            <p style={{ fontSize: 14, color: "var(--t2)" }}>Every dollar has a job.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setPeriod(prevPeriodStr(period))} style={{ padding: "9px 15px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--t3)", cursor: "pointer", fontSize: 15, transition: "all 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"}
            >←</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", minWidth: 140, textAlign: "center" }}>{periodLabel(period)}</div>
            <button onClick={() => setPeriod(nextPeriod(period))} style={{ padding: "9px 15px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--t3)", cursor: "pointer", fontSize: 15, transition: "all 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"}
            >→</button>
          </div>
        </div>

        {/* Ready to Assign */}
        <HudCard style={{ padding: "28px 36px", marginBottom: 20 }} delay={0.05}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
            <div style={{ display: "flex", gap: 48, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t4)", marginBottom: 8 }}>Ready to Assign</div>
                <div style={{ fontSize: 48, fontWeight: 800, fontFamily: "monospace", letterSpacing: "-0.02em", color: readyToAssign >= 0 ? "var(--green)" : "var(--red)" }}>
                  {readyToAssign < 0 ? "-" : ""}${fmtInt(Math.abs(readyToAssign))}
                </div>
                {readyToAssign < 0 && (
                  <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>Over-budgeted — reduce some categories</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 32, paddingTop: 4, flexWrap: "wrap" }}>
                {[
                  { label: "Income", value: monthlyIncome, color: "var(--green)", click: () => setModal("income") },
                  { label: "Budgeted", value: totalBudgeted, color: "var(--blue)", click: undefined },
                  { label: "Spent", value: totalSpent, color: "var(--amber)", click: undefined },
                ].map(s => (
                  <div key={s.label} onClick={s.click} style={{ cursor: s.click ? "pointer" : "default" }}>
                    <div style={{ fontSize: 10, color: "var(--t4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: s.color }}>
                      ${fmtInt(s.value)}
                    </div>
                    {s.click && <div style={{ fontSize: 10, color: "rgba(69,137,255,0.5)", marginTop: 4 }}>click to edit</div>}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setModal("add")}
              style={{
                padding: "11px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: "rgba(69,137,255,0.12)", border: "1px solid rgba(69,137,255,0.3)", color: "var(--blue)",
                transition: "all 0.15s", display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(69,137,255,0.22)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(69,137,255,0.12)"}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Add Category
            </button>
          </div>
        </HudCard>

        {/* Needs Review */}
        {needsReview.length > 0 && (
          <HudCard style={{ padding: "20px 28px", marginBottom: 20, borderColor: "rgba(245,158,11,0.18)" }} delay={0.08}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--amber)", boxShadow: "0 0 8px var(--amber)", animation: "pulse-dot 2s ease-in-out infinite" }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Needs Review</div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "rgba(245,158,11,0.15)", color: "var(--amber)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  {needsReview.length}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--t4)" }}>Click a transaction — rule is saved for all future purchases from that merchant</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {needsReview.slice(0, 6).map(tx => (
                <div
                  key={tx.id}
                  onClick={() => setReviewing(tx)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 7,
                    background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.1)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.1)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.05)"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{tx.merchant}</div>
                    <div style={{ fontSize: 11, color: "var(--t4)" }}>{new Date(tx.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ fontSize: 11, color: "var(--amber)", background: "rgba(245,158,11,0.1)", padding: "3px 9px", borderRadius: 4, fontWeight: 600 }}>Uncategorized</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "var(--red)", minWidth: 64, textAlign: "right" }}>-${fmt(tx.amount)}</div>
                  </div>
                </div>
              ))}
              {needsReview.length > 6 && (
                <div style={{ fontSize: 12, color: "var(--t4)", textAlign: "center", paddingTop: 4 }}>+{needsReview.length - 6} more</div>
              )}
            </div>
          </HudCard>
        )}

        {/* Category grid */}
        {allocations.length === 0 ? (
          <HudCard style={{ padding: "56px 40px", textAlign: "center" }} delay={0.1}>
            <div style={{ fontSize: 40, marginBottom: 16, color: "rgba(69,137,255,0.4)" }}>◈</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>No budget set up yet</div>
            <div style={{ fontSize: 14, color: "var(--t3)", marginBottom: 32, maxWidth: 380, margin: "0 auto 32px" }}>
              Zero-based budgeting means every dollar of income has a job. Start with defaults or build your own.
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={quickSetup} style={{ padding: "12px 28px", borderRadius: 8, fontSize: 14, fontWeight: 700, background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.35)", color: "var(--blue)", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(69,137,255,0.25)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(69,137,255,0.15)"}
              >
                Quick Setup — Load Defaults
              </button>
              <button onClick={() => setModal("add")} style={{ padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "var(--t3)", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                Build Manually
              </button>
            </div>
          </HudCard>
        ) : (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--t4)", marginBottom: 12 }}>
              Categories · {allocations.length}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10, marginBottom: 24 }}>
              {allocations.map((alloc) => {
                const spent     = spendByCategory[alloc.category] ?? 0;
                const pct       = alloc.budgeted > 0 ? (spent / alloc.budgeted) * 100 : 0;
                const remaining = alloc.budgeted - spent;
                const color     = CATEGORY_COLORS[alloc.category] ?? "#4589ff";
                const status    = pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--amber)" : "var(--green)";
                return (
                  <div
                    key={alloc.id}
                    onClick={() => setModal({ type: "edit", alloc })}
                    style={{
                      padding: "18px 20px", borderRadius: 10, cursor: "pointer",
                      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.045)"; (e.currentTarget as HTMLElement).style.borderColor = `${color}35`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{alloc.category}</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: status }}>{pct.toFixed(0)}%</div>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 14 }}>
                      <div style={{ height: "100%", borderRadius: 2, width: `${Math.min(100, pct)}%`, background: status, transition: "width 0.8s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <div style={{ fontSize: 19, fontWeight: 800, fontFamily: "monospace", color: "var(--t1)" }}>${fmtInt(spent)}</div>
                        <div style={{ fontSize: 11, color: "var(--t4)", marginTop: 2 }}>of ${alloc.budgeted.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: remaining >= 0 ? "var(--t2)" : "var(--red)" }}>
                          {remaining >= 0 ? `$${fmtInt(remaining)}` : `-$${fmtInt(Math.abs(remaining))}`}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--t4)", marginTop: 2 }}>{remaining >= 0 ? "left" : "over"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Transactions */}
        {spendingTx.length > 0 && (
          <HudCard style={{ padding: "28px 28px" }} delay={0.2}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Transactions</h2>
              <div style={{ fontSize: 12, color: "var(--t4)" }}>{spendingTx.length} this month</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {spendingTx.slice(0, 40).map((tx, i) => {
                const cat   = tx.budget_category ?? tx.category ?? "Misc";
                const color = CATEGORY_COLORS[cat] ?? "#6b7280";
                return (
                  <div
                    key={tx.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "11px 0",
                      borderBottom: i < spendingTx.slice(0, 40).length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: `${color}14`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color }}>
                        {(tx.merchant ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.merchant}</div>
                        <div style={{ fontSize: 11, color: "var(--t4)", marginTop: 1 }}>{new Date(tx.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                      <div
                        onClick={() => setReviewing(tx)}
                        title="Click to recategorize"
                        style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, cursor: "pointer", background: `${color}14`, color, border: `1px solid ${color}25`, transition: "all 0.1s", whiteSpace: "nowrap" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${color}28`}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${color}14`}
                      >
                        {cat}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "var(--red)", minWidth: 72, textAlign: "right" }}>
                        -${fmt(tx.amount)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </HudCard>
        )}
      </div>
    </div>
  );
}
