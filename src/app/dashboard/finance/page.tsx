"use client";

import { useState, useEffect } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { Sparkline } from "@/components/ui/Sparkline";
import { supabase } from "@/lib/supabase";

/* ── Types ── */
interface WealthData    { ira: number; savings: number; btc_amount: number; xrp_amount: number }
interface IRAFund       { symbol: string; name: string; nav: number; chg: number; value: number; shares: number }
interface Bill          { name: string; amt: number; due: number }
interface LiveCrypto    { symbol: string; name: string; price: number; c24: number; c7: number; data: number[] }
interface WealthHistory { recorded_at: string; net_worth: number; crypto_total: number; ira_total: number; savings: number }

const WEALTH_DEFAULTS: WealthData = { ira: 2720, savings: 2800, btc_amount: 0.02, xrp_amount: 200 };

const IRA_INIT: IRAFund[] = [
  { symbol: "MDDVX", name: "Mid-Cap Growth Index", nav: 42.18, chg: 0.32,  value: 1200, shares: 28.45 },
  { symbol: "RPEAX", name: "Real Assets Fund",     nav: 11.44, chg: -0.18, value: 880,  shares: 76.92 },
  { symbol: "PTTRX", name: "Total Return Bond",    nav: 9.87,  chg: 0.05,  value: 640,  shares: 64.84 },
];

const BILLS_INIT: Bill[] = [
  { name: "Rent",    amt: 950,   due: 1  },
  { name: "Spotify", amt: 10.99, due: 3  },
  { name: "Phone",   amt: 75,    due: 8  },
  { name: "Netflix", amt: 15.49, due: 18 },
  { name: "Gym",     amt: 40,    due: 22 },
];

/* ── Edit Modal ── */
interface Field { key: string; label: string; prefix?: string; suffix?: string; step?: number }
function EditModal({ title, fields, values, onSave, onClose, extra }: {
  title: string;
  fields: Field[];
  values: Record<string, number | string>;
  onSave: (vals: Record<string, number | string>) => void;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, String(values[f.key] ?? "")]))
  );

  useEffect(() => {
    setDraft(Object.fromEntries(fields.map(f => [f.key, String(values[f.key] ?? "")])));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map(f => f.key).join(",")]);

  function handleSave() {
    const result: Record<string, number | string> = {};
    for (const f of fields) {
      const n = parseFloat(draft[f.key]);
      result[f.key] = isNaN(n) ? draft[f.key] : n;
    }
    onSave(result);
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 12, padding: "28px 32px", width: 440, maxWidth: "90vw",
        maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: extra ? 20 : 28 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--t3)", display: "block", marginBottom: 6 }}>
                {f.label}
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                {f.prefix && <span style={{ position: "absolute", left: 12, fontSize: 14, color: "var(--t3)", fontFamily: "monospace" }}>{f.prefix}</span>}
                <input
                  type="number"
                  step={f.step ?? "any"}
                  value={draft[f.key]}
                  onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
                  style={{
                    width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
                    borderRadius: 6, padding: `10px 12px ${f.suffix ? "10px 40px" : "10px 12px"} ${f.prefix ? "28px" : "12px"}`,
                    color: "var(--t1)", fontFamily: "monospace", fontSize: 14, fontWeight: 600, outline: "none",
                    transition: "border-color .15s",
                  }}
                  onFocus={e => (e.target.style.borderColor = "var(--blue)")}
                  onBlur={e => (e.target.style.borderColor = "var(--border2)")}
                />
                {f.suffix && <span style={{ position: "absolute", right: 12, fontSize: 13, color: "var(--t3)", fontFamily: "monospace" }}>{f.suffix}</span>}
              </div>
            </div>
          ))}
        </div>

        {extra && <div style={{ marginBottom: 24 }}>{extra}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)",
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            flex: 2, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.4)", color: "var(--blue)",
          }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ── Pencil button ── */
function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Edit" style={{
      background: "none", border: "1px solid var(--border)", borderRadius: 5,
      padding: "5px 7px", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, transition: "all .15s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--blue)"; (e.currentTarget as HTMLElement).style.color = "var(--blue)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Edit
    </button>
  );
}

/* ── Allocation Bar ── */
function AllocationBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2, marginBottom: 10 }}>
        {segments.map(s => (
          <div key={s.label} style={{
            flex: s.value / total,
            background: s.color,
            borderRadius: 4,
            transition: "flex 0.6s ease",
            minWidth: 4,
          }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--t3)" }}>{s.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", fontFamily: "monospace" }}>
              {total > 0 ? ((s.value / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Bills Edit Modal with add/remove ── */
function BillsModal({ bills, onSave, onClose }: {
  bills: Bill[];
  onSave: (bills: Bill[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Bill[]>(bills.map(b => ({ ...b })));

  function update(i: number, key: keyof Bill, val: string) {
    setDraft(p => p.map((b, j) => j === i ? { ...b, [key]: key === "name" ? val : parseFloat(val) || 0 } : b));
  }

  function remove(i: number) {
    setDraft(p => p.filter((_, j) => j !== i));
  }

  function add() {
    setDraft(p => [...p, { name: "New Bill", amt: 0, due: 1 }]);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 12, padding: "28px 32px", width: 500, maxWidth: "92vw",
        maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Edit Monthly Bills</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 70px 32px", gap: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
            {["Name", "Amount", "Due Day", ""].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--t3)" }}>{h}</span>
            ))}
          </div>
          {draft.map((b, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 70px 32px", gap: 8, alignItems: "center" }}>
              <input
                value={b.name}
                onChange={e => update(i, "name", e.target.value)}
                style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 5, padding: "8px 10px", color: "var(--t1)", fontSize: 13, fontWeight: 600, outline: "none" }}
                onFocus={e => (e.target.style.borderColor = "var(--blue)")}
                onBlur={e => (e.target.style.borderColor = "var(--border2)")}
              />
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--t3)", fontFamily: "monospace" }}>$</span>
                <input
                  type="number" step="0.01" value={b.amt}
                  onChange={e => update(i, "amt", e.target.value)}
                  style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 5, padding: "8px 8px 8px 20px", color: "var(--t1)", fontFamily: "monospace", fontSize: 13, fontWeight: 600, outline: "none" }}
                  onFocus={e => (e.target.style.borderColor = "var(--blue)")}
                  onBlur={e => (e.target.style.borderColor = "var(--border2)")}
                />
              </div>
              <input
                type="number" min="1" max="31" step="1" value={b.due}
                onChange={e => update(i, "due", e.target.value)}
                style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 5, padding: "8px 8px", color: "var(--t1)", fontFamily: "monospace", fontSize: 13, fontWeight: 600, outline: "none", textAlign: "center" }}
                onFocus={e => (e.target.style.borderColor = "var(--blue)")}
                onBlur={e => (e.target.style.borderColor = "var(--border2)")}
              />
              <button onClick={() => remove(i)} style={{
                background: "none", border: "1px solid var(--border)", borderRadius: 4,
                padding: "7px", cursor: "pointer", color: "var(--t3)", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLElement).style.color = "var(--red)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button onClick={add} style={{
          width: "100%", padding: "10px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: "transparent", border: "1px dashed var(--border2)", color: "var(--t3)", marginBottom: 20,
          transition: "all .15s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--blue)"; (e.currentTarget as HTMLElement).style.color = "var(--blue)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)"; (e.currentTarget as HTMLElement).style.color = "var(--t3)"; }}
        >
          + Add Bill
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: "transparent", border: "1px solid var(--border2)", color: "var(--t3)",
          }}>Cancel</button>
          <button onClick={() => { onSave(draft); onClose(); }} style={{
            flex: 2, padding: "11px 0", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: "rgba(69,137,255,0.15)", border: "1px solid rgba(69,137,255,0.4)", color: "var(--blue)",
          }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function FinancePage() {
  const [live, setLive]           = useState<LiveCrypto[]>([]);
  const [wealth, setWealth]       = useState<WealthData>(WEALTH_DEFAULTS);
  const [ira, setIra]             = useState<IRAFund[]>(IRA_INIT);
  const [bills, setBills]         = useState<Bill[]>(BILLS_INIT);
  const [modal, setModal]         = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [wealthHistory, setWealthHistory] = useState<WealthHistory[]>([]);

  useEffect(() => {
    fetch("/api/crypto").then(r => r.json()).then(j => {
      if (!j.data) return;
      const btc = j.data.find((d: { symbol: string }) => d.symbol === "BTC");
      const xrp = j.data.find((d: { symbol: string }) => d.symbol === "XRP");
      const next: LiveCrypto[] = [];
      if (btc) next.push({ symbol: "BTC", name: "Bitcoin", price: btc.price, c24: btc.change24h ?? 0, c7: btc.change7d ?? 0, data: btc.sparkline?.slice(-20) ?? [] });
      if (xrp) next.push({ symbol: "XRP", name: "Ripple",  price: xrp.price, c24: xrp.change24h ?? 0, c7: xrp.change7d ?? 0, data: xrp.sparkline?.slice(-20) ?? [] });
      setLive(next);
    }).catch(() => {});

    supabase.from("wealth").select("*").limit(1).then(({ data }) => {
      if (data && data.length > 0) setWealth(p => ({ ...p, ...data[0] }));
    });

    supabase.from("ira_funds").select("*").then(({ data }) => {
      if (data && data.length > 0) setIra(data as IRAFund[]);
    });

    supabase.from("bills").select("*").order("due").then(({ data }) => {
      if (data && data.length > 0) setBills(data as Bill[]);
    });

    supabase.from("wealth_history").select("*").order("recorded_at", { ascending: true }).limit(30).then(({ data }) => {
      if (data && data.length > 0) setWealthHistory(data as WealthHistory[]);
    });
  }, []);

  // Realtime subscription: update wealth when M.A.X. modifies it
  useEffect(() => {
    const channel = supabase.channel("finance-wealth-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "wealth" }, payload => {
        if (payload.new) setWealth(p => ({ ...p, ...(payload.new as WealthData) }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function saveWealth(updates: Partial<WealthData>) {
    const updated = { ...wealth, ...updates };
    setWealth(updated);
    await supabase.from("wealth").upsert({ id: "max", ...updated });
  }

  async function saveIra(updated: IRAFund[]) {
    setIra(updated);
    setSaving(true);
    await supabase.from("ira_funds").delete().neq("symbol", "NEVER_MATCH");
    await supabase.from("ira_funds").insert(updated);
    setSaving(false);
  }

  async function saveBills(updated: Bill[]) {
    setBills(updated);
    setSaving(true);
    await supabase.from("bills").delete().neq("name", "NEVER_MATCH");
    await supabase.from("bills").insert(updated);
    setSaving(false);
  }

  const btcPrice = live.find(l => l.symbol === "BTC")?.price ?? 75912;
  const xrpPrice = live.find(l => l.symbol === "XRP")?.price ?? 1.43;

  const btcVal      = btcPrice * wealth.btc_amount;
  const xrpVal      = xrpPrice * wealth.xrp_amount;
  const cryptoTotal = btcVal + xrpVal;
  const iraTotal    = ira.reduce((a, f) => a + f.value, 0);
  const netWorth    = cryptoTotal + iraTotal + wealth.savings;
  const billsTotal  = bills.reduce((a, b) => a + b.amt, 0);

  /* Dynamic emergency fund insight */
  const savingsGoal     = 10000;
  const savingsNeeded   = savingsGoal - wealth.savings;
  const today           = new Date();
  const savingsPct      = Math.round((wealth.savings / savingsGoal) * 100);
  const monthlyNeeded   = savingsNeeded > 0 ? savingsNeeded / 6 : 0;
  const monthsAt200     = savingsNeeded > 0 ? Math.ceil(savingsNeeded / 200) : 0;
  const targetDate      = new Date(today.getFullYear(), today.getMonth() + monthsAt200, 1);
  const targetLabel     = targetDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const fasterAmt       = Math.ceil(monthlyNeeded * 1.3 / 50) * 50;
  const fasterMonths    = savingsNeeded > 0 ? Math.ceil(savingsNeeded / fasterAmt) : 0;
  const fasterDate      = new Date(today.getFullYear(), today.getMonth() + fasterMonths, 1);
  const fasterLabel     = fasterDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  let fundInsight = "";
  if (savingsPct >= 100) {
    fundInsight = "Goal reached — fully funded emergency fund. Consider raising the target to 6 months of expenses.";
  } else if (savingsNeeded > 0) {
    fundInsight = `At $200/mo you'll hit $10k by ${targetLabel}. Save $${fasterAmt}/mo to reach it by ${fasterLabel} instead.`;
  }

  /* Next bill due */
  const dayOfMonth = today.getDate();
  const sortedBills = [...bills].sort((a, b) => {
    const da = a.due >= dayOfMonth ? a.due - dayOfMonth : a.due + 31 - dayOfMonth;
    const db = b.due >= dayOfMonth ? b.due - dayOfMonth : b.due + 31 - dayOfMonth;
    return da - db;
  });
  const nextBill = sortedBills[0];

  const CRYPTO_DISPLAY = live.length
    ? live
    : [
        { symbol: "BTC", name: "Bitcoin", price: btcPrice, c24: 1.47, c7: 5.2,  data: [88200,89100,91400,90800,92300,93100,94210] as number[] },
        { symbol: "XRP", name: "Ripple",  price: xrpPrice, c24: 0.89, c7: 3.1,  data: [2.31,2.18,2.25,2.09,2.14,2.29,2.18] as number[] },
      ];

  return (
    <div style={{ padding: "40px 52px", background: "var(--bg)", minHeight: "100vh" }}>
      {/* Modals */}
      {modal === "crypto" && (
        <EditModal
          title="Edit Crypto Holdings"
          fields={[
            { key: "btc_amount", label: "BTC Amount", suffix: "BTC", step: 0.00000001 },
            { key: "xrp_amount", label: "XRP Amount", suffix: "XRP", step: 1 },
          ]}
          values={{ btc_amount: wealth.btc_amount, xrp_amount: wealth.xrp_amount }}
          onSave={v => saveWealth({ btc_amount: v.btc_amount as number, xrp_amount: v.xrp_amount as number })}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "ira" && (
        <EditModal
          title="Edit Roth IRA Holdings"
          fields={ira.flatMap(f => [
            { key: `${f.symbol}_value`,  label: `${f.symbol} — Value`,  prefix: "$", step: 0.01 },
            { key: `${f.symbol}_shares`, label: `${f.symbol} — Shares`, step: 0.01 },
            { key: `${f.symbol}_nav`,    label: `${f.symbol} — NAV`,    prefix: "$", step: 0.01 },
          ])}
          values={Object.fromEntries(ira.flatMap(f => [
            [`${f.symbol}_value`, f.value], [`${f.symbol}_shares`, f.shares], [`${f.symbol}_nav`, f.nav],
          ]))}
          onSave={v => {
            saveIra(ira.map(f => ({
              ...f,
              value:  (v[`${f.symbol}_value`]  as number) ?? f.value,
              shares: (v[`${f.symbol}_shares`] as number) ?? f.shares,
              nav:    (v[`${f.symbol}_nav`]    as number) ?? f.nav,
            })));
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "savings" && (
        <EditModal
          title="Edit Emergency Fund"
          fields={[{ key: "savings", label: "Current Balance", prefix: "$", step: 0.01 }]}
          values={{ savings: wealth.savings }}
          onSave={v => saveWealth({ savings: v.savings as number })}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "bills" && (
        <BillsModal bills={bills} onSave={saveBills} onClose={() => setModal(null)} />
      )}

      <div style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div className="afu" style={{ marginBottom: 36, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--blue)", opacity: 0.7, marginBottom: 8 }}>Finance Hub</p>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: "var(--t1)", letterSpacing: "-0.02em", marginBottom: 6 }}>Portfolio</h1>
            <p style={{ fontSize: 14, color: "var(--t2)" }}>Crypto · Roth IRA · Savings · Bills</p>
          </div>
          {saving && <span style={{ fontSize: 12, color: "var(--t3)" }}>Saving…</span>}
        </div>

        {/* Net Worth Banner */}
        <HudCard style={{ padding: "32px 36px", marginBottom: 24 }} delay={.05}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 12 }}>Tracked Net Worth</p>
              <div style={{ fontSize: 52, fontWeight: 800, color: "var(--t1)", fontFamily: "monospace", letterSpacing: "-0.02em", marginBottom: 4 }}>
                ${netWorth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {nextBill && (
                <p style={{ fontSize: 12, color: "var(--t3)" }}>
                  Next bill: <span style={{ color: nextBill.due - dayOfMonth <= 3 ? "var(--red)" : "var(--t2)", fontWeight: 600 }}>{nextBill.name} ${nextBill.amt % 1 === 0 ? nextBill.amt : nextBill.amt.toFixed(2)}</span>
                  <span style={{ marginLeft: 6, color: "var(--t3)" }}>— day {nextBill.due}</span>
                </p>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "right" }}>
              {[
                { l: "Crypto",   v: `$${cryptoTotal.toFixed(0)}`,   c: "var(--amber)" },
                { l: "Roth IRA", v: `$${iraTotal.toFixed(0)}`,      c: "var(--blue)"  },
                { l: "Savings",  v: `$${wealth.savings.toLocaleString()}`, c: "var(--green)" },
              ].map(r => (
                <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 13, color: "var(--t3)" }}>{r.l}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: r.c }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
          <AllocationBar segments={[
            { label: "Crypto",   value: cryptoTotal,    color: "var(--amber)" },
            { label: "Roth IRA", value: iraTotal,        color: "var(--blue)"  },
            { label: "Savings",  value: wealth.savings,  color: "var(--green)" },
          ]} />

          {wealthHistory.length >= 2 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--t4)", marginBottom: 10 }}>Net Worth History (30 days)</p>
              <Sparkline
                data={wealthHistory.map(h => h.net_worth)}
                color="var(--blue)"
                height={56}
                id="nw-history"
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "var(--t4)" }}>{new Date(wealthHistory[0].recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: wealthHistory[wealthHistory.length-1].net_worth >= wealthHistory[0].net_worth ? "var(--green)" : "var(--red)" }}>
                  {wealthHistory[wealthHistory.length-1].net_worth >= wealthHistory[0].net_worth ? "+" : ""}
                  ${(wealthHistory[wealthHistory.length-1].net_worth - wealthHistory[0].net_worth).toLocaleString("en-US", { maximumFractionDigits: 0 })} vs {wealthHistory.length}d ago
                </span>
                <span style={{ fontSize: 10, color: "var(--t4)" }}>{new Date(wealthHistory[wealthHistory.length-1].recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            </div>
          )}
        </HudCard>

        {/* Crypto + Right */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

          {/* Crypto */}
          <HudCard style={{ padding: "28px 28px" }} delay={.1}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Crypto Holdings</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: live.length ? "var(--green)" : "var(--amber)", animation: "pulse-dot 2s ease-in-out infinite", display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>{live.length ? "CoinGecko · Live" : "CoinGecko · Cached"}</span>
                </div>
              </div>
              <EditBtn onClick={() => setModal("crypto")} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {CRYPTO_DISPLAY.map(a => {
                const held = a.symbol === "BTC" ? wealth.btc_amount : wealth.xrp_amount;
                const val  = a.price * held;
                return (
                  <div key={a.symbol}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--t1)" }}>{a.symbol[0]}</div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>{a.symbol} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--t3)" }}>{a.name}</span></div>
                          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{parseFloat(held.toFixed(8))} {a.symbol}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: "var(--t1)" }}>
                          ${a.symbol === "BTC" ? Math.round(a.price).toLocaleString() : a.price.toFixed(4)}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: a.c24 >= 0 ? "var(--green)" : "var(--red)" }}>
                          {a.c24 >= 0 ? "+" : ""}{Number(a.c24).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <Sparkline data={a.data} color={a.c24 >= 0 ? "var(--green)" : "var(--red)"} height={48} id={`f-${a.symbol}`} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                      <span style={{ color: "var(--t3)" }}>7d: <span style={{ color: a.c7 >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{a.c7 >= 0 ? "+" : ""}{Number(a.c7).toFixed(2)}%</span></span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--t1)" }}>${val.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </HudCard>

          {/* Right: IRA + Emergency Fund */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Roth IRA */}
            <HudCard style={{ padding: "28px 28px" }} delay={.15}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Roth IRA</h2>
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>Schwab</span>
                </div>
                <EditBtn onClick={() => setModal("ira")} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ira.map(f => (
                  <div key={f.symbol} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{f.symbol}</div>
                      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{f.name} · {f.shares} shares</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "var(--t1)" }}>${f.value.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: f.chg >= 0 ? "var(--green)" : "var(--red)", marginTop: 2 }}>
                        NAV ${f.nav} ({f.chg >= 0 ? "+" : ""}{f.chg}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", marginTop: 12, borderRadius: 6, background: "var(--surface3)", border: "1px solid var(--border2)" }}>
                <span style={{ fontSize: 13, color: "var(--t2)" }}>Total IRA Value</span>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: "var(--blue)" }}>${iraTotal.toFixed(2)}</span>
              </div>
            </HudCard>

            {/* Emergency Fund */}
            <HudCard style={{ padding: "28px 28px" }} delay={.2}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Emergency Fund</h2>
                <EditBtn onClick={() => setModal("savings")} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 16 }}>
                <svg width="84" height="84" viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
                  <circle cx="42" cy="42" r="34" fill="none" stroke="var(--border2)" strokeWidth="5" />
                  <circle cx="42" cy="42" r="34" fill="none" stroke="var(--blue)" strokeWidth="5"
                    strokeDasharray={2*Math.PI*34} strokeDashoffset={2*Math.PI*34*(1-Math.min(1, wealth.savings/savingsGoal))}
                    strokeLinecap="round" transform="rotate(-90 42 42)"
                    style={{ transition: "stroke-dashoffset 1s ease" }} />
                  <text x="42" y="38" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--t1)">{savingsPct}%</text>
                  <text x="42" y="54" textAnchor="middle" fontSize="10" fill="var(--t3)">funded</text>
                </svg>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--t1)", fontFamily: "monospace" }}>${wealth.savings.toLocaleString()}</div>
                  <div style={{ fontSize: 13, color: "var(--blue)", marginTop: 4 }}>of $10,000 goal</div>
                  <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>${(savingsGoal - wealth.savings).toLocaleString()} remaining</div>
                </div>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ color: "var(--blue)", fontWeight: 700 }}>M.A.X. · </span>
                <span style={{ color: "var(--t2)" }}>{fundInsight}</span>
              </div>
            </HudCard>
          </div>
        </div>

        {/* Bills */}
        <HudCard style={{ padding: "28px 28px" }} delay={.25}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Monthly Bills</h2>
              <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 4 }}>
                Total: <span style={{ fontWeight: 800, color: "var(--t1)" }}>${billsTotal.toFixed(2)}</span>
                <span style={{ color: "var(--t3)", marginLeft: 16 }}>Annual: <span style={{ fontWeight: 700, color: "var(--t2)" }}>${(billsTotal * 12).toFixed(0)}</span></span>
              </p>
            </div>
            <EditBtn onClick={() => setModal("bills")} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(bills.length, 5)}, 1fr)`, gap: 12 }}>
            {sortedBills.map(b => {
              const daysUntil = b.due >= dayOfMonth ? b.due - dayOfMonth : b.due + 31 - dayOfMonth;
              const urgent    = daysUntil <= 3;
              return (
                <div key={b.name} style={{
                  padding: "20px 16px", borderRadius: 6, textAlign: "center",
                  background: urgent ? "rgba(239,68,68,0.06)" : "var(--surface2)",
                  border: `1px solid ${urgent ? "rgba(239,68,68,0.2)" : "var(--border)"}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", marginBottom: 8 }}>{b.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: urgent ? "var(--red)" : "var(--t1)", marginBottom: 6 }}>
                    ${b.amt % 1 === 0 ? b.amt : b.amt.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: urgent ? "var(--red)" : "var(--t3)" }}>
                    {daysUntil === 0 ? "⚠ Due today" : urgent ? `⚠ ${daysUntil}d away` : `Day ${b.due}`}
                  </div>
                </div>
              );
            })}
          </div>
        </HudCard>
      </div>
    </div>
  );
}
