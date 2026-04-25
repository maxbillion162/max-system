"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Sparkline } from "@/components/ui/Sparkline";

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export type Classification = "need" | "want" | "savings" | "investment";

interface Allocation {
  id:        string;
  category:  string;
  budgeted:  number;
  rollover?: boolean;
}

type SortKey = "category" | "budgeted" | "spent" | "remaining" | "pct" | "trend";
type SortDir = "asc" | "desc";
type FilterKey = "all" | "over" | "tight" | "drifting" | "unspent";

interface Row {
  alloc:          Allocation;
  spent:          number;
  remaining:      number;
  pct:            number;
  classification: Classification;
  history:        number[];
  trend:          number | null;
  color:          string;
  status:         "ok" | "tight" | "over" | "unspent";
}

interface BudgetTableProps {
  allocations:             Allocation[];
  spendByCategory:         Record<string, number>;
  monthlyHistoryByCategory:Record<string, number[]>;
  classifications:         Record<string, Classification>;
  categoryColors:          Record<string, string>;

  selectedCategory:        string | null;
  onSelect:                (category: string | null) => void;

  onUpdateBudgeted:        (id: string, budgeted: number) => Promise<void>;
  onUpdateRollover:        (id: string, next: boolean)    => Promise<void>;
  onClassify:              (category: string, type: Classification) => Promise<void>;
}

const CLASS_THEME: Record<Classification, { color: string; label: string }> = {
  need:       { color: "#5FB07D", label: "NEED" },
  want:       { color: "#B89A6E", label: "WANT" },
  savings:    { color: "#7DB8E8", label: "SAVE" },
  investment: { color: "#9B7BC2", label: "INVEST" },
};

const GROUP_ORDER: Classification[] = ["need", "want", "savings", "investment"];

const FILTERS: { key: FilterKey; label: string; predicate: (r: Row) => boolean }[] = [
  { key: "all",      label: "ALL",      predicate: () => true },
  { key: "over",     label: "OVER",     predicate: r => r.status === "over" },
  { key: "tight",    label: "TIGHT",    predicate: r => r.status === "tight" },
  { key: "drifting", label: "DRIFTING", predicate: r => r.trend !== null && r.trend > 10 },
  { key: "unspent",  label: "UNSPENT",  predicate: r => r.status === "unspent" },
];

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function BudgetTable(p: BudgetTableProps) {
  const [filter, setFilter]   = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editing, setEditing] = useState<{ id: string; field: "budgeted" } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const rows = useMemo<Row[]>(() => {
    return p.allocations.map(a => {
      const spent     = p.spendByCategory[a.category] ?? 0;
      const remaining = a.budgeted - spent;
      const pct       = a.budgeted > 0 ? (spent / a.budgeted) * 100 : 0;
      const cls       = p.classifications[a.category] ?? "want";
      const hist      = p.monthlyHistoryByCategory[a.category] ?? [];
      const trend     = hist.length >= 2 && hist[hist.length - 2] > 0
                          ? ((hist[hist.length - 1] - hist[hist.length - 2]) / hist[hist.length - 2]) * 100
                          : null;
      const color = p.categoryColors[a.category] ?? "#7DB8E8";
      let status: Row["status"] = "ok";
      if      (pct >= 100) status = "over";
      else if (pct >= 80)  status = "tight";
      else if (pct < 5 && spent === 0) status = "unspent";
      return { alloc: a, spent, remaining, pct, classification: cls, history: hist, trend, color, status };
    });
  }, [p.allocations, p.spendByCategory, p.classifications, p.monthlyHistoryByCategory, p.categoryColors]);

  const filtered = useMemo(() => {
    const fn = FILTERS.find(f => f.key === filter)!.predicate;
    return rows.filter(fn);
  }, [rows, filter]);

  const grouped = useMemo(() => {
    const out: Record<Classification, Row[]> = { need: [], want: [], savings: [], investment: [] };
    for (const r of filtered) out[r.classification].push(r);
    for (const k of GROUP_ORDER) out[k].sort(comparator(sortKey, sortDir));
    return out;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "category" ? "asc" : "desc"); }
  }

  function startEdit(id: string, current: number) {
    setEditing({ id, field: "budgeted" });
    setEditValue(String(current));
  }

  async function commitEdit() {
    if (!editing) return;
    const next = Math.max(0, parseFloat(editValue) || 0);
    await p.onUpdateBudgeted(editing.id, next);
    setEditing(null);
  }

  function cancelEdit() { setEditing(null); }

  return (
    <div style={{
      background: "linear-gradient(160deg, #0f141d 0%, #080b11 100%)",
      border: "1px solid rgba(125,184,232,0.10)", borderRadius: 3,
      overflow: "hidden",
    }}>
      {/* Filter bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid var(--border)",
        gap: 10, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {FILTERS.map(f => {
            const matchCount = rows.filter(f.predicate).length;
            const active = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: "5px 12px", borderRadius: 2,
                background: active ? "var(--blue-dim)" : "transparent",
                border: `1px solid ${active ? "var(--blue-border)" : "var(--border)"}`,
                color: active ? "var(--blue)" : "var(--t3)",
                cursor: "pointer", fontFamily: MONO,
                fontSize: 9, letterSpacing: "0.18em", fontWeight: 700,
              }}>
                {f.label} <span style={{ opacity: 0.5, marginLeft: 3 }}>{matchCount}</span>
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.16em" }}>
          {filtered.length} OF {rows.length}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <Th onClick={() => toggleSort("category")} active={sortKey === "category"} dir={sortDir} align="left">CATEGORY</Th>
              <Th>TYPE</Th>
              <Th onClick={() => toggleSort("budgeted")} active={sortKey === "budgeted"} dir={sortDir}>BUDGET</Th>
              <Th onClick={() => toggleSort("spent")}    active={sortKey === "spent"}    dir={sortDir}>SPENT</Th>
              <Th onClick={() => toggleSort("remaining")}active={sortKey === "remaining"}dir={sortDir}>LEFT</Th>
              <Th onClick={() => toggleSort("pct")}      active={sortKey === "pct"}      dir={sortDir}>%</Th>
              <Th onClick={() => toggleSort("trend")}    active={sortKey === "trend"}    dir={sortDir}>TREND</Th>
              <Th>R</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {GROUP_ORDER.map(group => {
              const groupRows = grouped[group];
              if (groupRows.length === 0) return null;
              const theme   = CLASS_THEME[group];
              const totalB  = groupRows.reduce((s, r) => s + r.alloc.budgeted, 0);
              const totalS  = groupRows.reduce((s, r) => s + r.spent, 0);
              return (
                <GroupBlock
                  key={group}
                  groupKey={group}
                  themeColor={theme.color}
                  themeLabel={theme.label}
                  rows={groupRows}
                  totalBudgeted={totalB}
                  totalSpent={totalS}
                  selectedCategory={p.selectedCategory}
                  editingId={editing?.id ?? null}
                  editValue={editValue}
                  onEditChange={setEditValue}
                  onStartEdit={startEdit}
                  onCommitEdit={commitEdit}
                  onCancelEdit={cancelEdit}
                  onSelectRow={p.onSelect}
                  onUpdateRollover={p.onUpdateRollover}
                  onClassify={p.onClassify}
                />
              );
            })}
            {/* Uncategorized fallback */}
            {(() => {
              const orphans = filtered.filter(r => !GROUP_ORDER.includes(r.classification));
              if (orphans.length === 0) return null;
              return (
                <GroupBlock
                  groupKey="want"
                  themeColor="#8794A6"
                  themeLabel="UNCLASSIFIED"
                  rows={orphans}
                  totalBudgeted={orphans.reduce((s, r) => s + r.alloc.budgeted, 0)}
                  totalSpent={orphans.reduce((s, r) => s + r.spent, 0)}
                  selectedCategory={p.selectedCategory}
                  editingId={editing?.id ?? null}
                  editValue={editValue}
                  onEditChange={setEditValue}
                  onStartEdit={startEdit}
                  onCommitEdit={commitEdit}
                  onCancelEdit={cancelEdit}
                  onSelectRow={p.onSelect}
                  onUpdateRollover={p.onUpdateRollover}
                  onClassify={p.onClassify}
                />
              );
            })()}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--t4)", fontSize: 12 }}>
            No categories match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

function comparator(key: SortKey, dir: SortDir) {
  const m = dir === "asc" ? 1 : -1;
  return (a: Row, b: Row) => {
    let av: number | string;
    let bv: number | string;
    switch (key) {
      case "category":  av = a.alloc.category.toLowerCase(); bv = b.alloc.category.toLowerCase(); break;
      case "budgeted":  av = a.alloc.budgeted; bv = b.alloc.budgeted; break;
      case "spent":     av = a.spent;          bv = b.spent;          break;
      case "remaining": av = a.remaining;      bv = b.remaining;      break;
      case "pct":       av = a.pct;            bv = b.pct;            break;
      case "trend":     av = a.trend ?? -Infinity; bv = b.trend ?? -Infinity; break;
    }
    if (av < bv) return -1 * m;
    if (av > bv) return  1 * m;
    return 0;
  };
}

interface GroupBlockProps {
  groupKey:        Classification;
  themeColor:      string;
  themeLabel:      string;
  rows:            Row[];
  totalBudgeted:   number;
  totalSpent:      number;
  selectedCategory:string | null;
  editingId:       string | null;
  editValue:       string;
  onEditChange:    (v: string) => void;
  onStartEdit:     (id: string, current: number) => void;
  onCommitEdit:    () => void;
  onCancelEdit:    () => void;
  onSelectRow:     (cat: string | null) => void;
  onUpdateRollover:(id: string, next: boolean) => Promise<void>;
  onClassify:      (cat: string, type: Classification) => Promise<void>;
}

function GroupBlock(p: GroupBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <tr
        onClick={() => setCollapsed(c => !c)}
        style={{
          background: "rgba(255,255,255,0.012)",
          borderBottom: "1px solid var(--border)",
          cursor: "pointer",
        }}
      >
        <td colSpan={3} style={{ padding: "8px 14px" }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.32em",
            color: p.themeColor, fontFamily: MONO,
          }}>
            {collapsed ? "▸" : "▾"}  {p.themeLabel}
          </span>
          <span style={{ fontSize: 10, color: "var(--t4)", marginLeft: 10, fontFamily: MONO, letterSpacing: "0.14em" }}>
            {p.rows.length} CATEGOR{p.rows.length === 1 ? "Y" : "IES"}
          </span>
        </td>
        <td style={{ padding: "8px 10px", textAlign: "right", color: p.themeColor, fontFamily: MONO, fontSize: 11 }}>
          ${fmtInt(p.totalBudgeted)}
        </td>
        <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--t1)", fontFamily: MONO, fontSize: 11 }}>
          ${fmtInt(p.totalSpent)}
        </td>
        <td style={{ padding: "8px 10px", textAlign: "right", color: p.totalBudgeted - p.totalSpent < 0 ? "var(--red)" : "var(--t2)", fontFamily: MONO, fontSize: 11 }}>
          ${fmtInt(p.totalBudgeted - p.totalSpent)}
        </td>
        <td colSpan={3} />
      </tr>
      {!collapsed && p.rows.map(r => (
        <CategoryRow
          key={r.alloc.id}
          row={r}
          selected={p.selectedCategory === r.alloc.category}
          editing={p.editingId === r.alloc.id}
          editValue={p.editValue}
          onEditChange={p.onEditChange}
          onStartEdit={p.onStartEdit}
          onCommitEdit={p.onCommitEdit}
          onCancelEdit={p.onCancelEdit}
          onSelectRow={p.onSelectRow}
          onUpdateRollover={p.onUpdateRollover}
          onClassify={p.onClassify}
        />
      ))}
    </>
  );
}

interface CategoryRowProps {
  row:             Row;
  selected:        boolean;
  editing:         boolean;
  editValue:       string;
  onEditChange:    (v: string) => void;
  onStartEdit:     (id: string, current: number) => void;
  onCommitEdit:    () => void;
  onCancelEdit:    () => void;
  onSelectRow:     (cat: string | null) => void;
  onUpdateRollover:(id: string, next: boolean) => Promise<void>;
  onClassify:      (cat: string, type: Classification) => Promise<void>;
}

function CategoryRow({
  row, selected, editing, editValue, onEditChange,
  onStartEdit, onCommitEdit, onCancelEdit, onSelectRow,
  onUpdateRollover, onClassify,
}: CategoryRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const statusColor =
    row.status === "over"  ? "var(--red)"   :
    row.status === "tight" ? "#B89A6E"      :
    row.status === "unspent" ? "var(--t4)"   :
                              "var(--green)";

  return (
    <tr
      onClick={() => onSelectRow(selected ? null : row.alloc.category)}
      style={{
        borderBottom: "1px solid var(--border)",
        background: selected ? "var(--blue-dim)" : "transparent",
        cursor: "pointer",
        transition: "background .12s",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.018)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
    >
      {/* CATEGORY name */}
      <td style={{ padding: "9px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 1, background: row.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500 }}>{row.alloc.category}</span>
        </div>
      </td>
      {/* TYPE — inline classification dropdown */}
      <td style={{ padding: "9px 6px" }} onClick={e => e.stopPropagation()}>
        <select
          value={row.classification}
          onChange={async e => { await onClassify(row.alloc.category, e.target.value as Classification); }}
          style={{
            background: "transparent", border: "1px solid transparent",
            color: CLASS_THEME[row.classification].color,
            fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
            padding: "3px 4px", borderRadius: 2, cursor: "pointer", outline: "none",
            appearance: "none",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLSelectElement).style.borderColor = "var(--border2)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLSelectElement).style.borderColor = "transparent"; }}
        >
          {GROUP_ORDER.map(k => <option key={k} value={k}>{CLASS_THEME[k].label}</option>)}
        </select>
      </td>
      {/* BUDGET — inline editable */}
      <td style={{ padding: "9px 10px", textAlign: "right" }} onClick={e => { e.stopPropagation(); onStartEdit(row.alloc.id, row.alloc.budgeted); }}>
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={e => {
              if (e.key === "Enter") onCommitEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--surface2)", border: "1px solid var(--blue-border)",
              borderRadius: 2, padding: "3px 6px", fontSize: 12,
              color: "var(--t1)", fontFamily: MONO, outline: "none",
              width: 70, textAlign: "right",
            }}
          />
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--t1)", borderBottom: "1px dotted var(--border2)", paddingBottom: 1 }}>
            ${fmtInt(row.alloc.budgeted)}
          </span>
        )}
      </td>
      {/* SPENT */}
      <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: MONO, fontSize: 12, color: "var(--t1)" }}>
        ${fmtInt(row.spent)}
      </td>
      {/* LEFT */}
      <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: MONO, fontSize: 12, color: row.remaining >= 0 ? "var(--t2)" : "var(--red)" }}>
        {row.remaining >= 0 ? `$${fmtInt(row.remaining)}` : `−$${fmtInt(Math.abs(row.remaining))}`}
      </td>
      {/* % with bar */}
      <td style={{ padding: "9px 10px", minWidth: 92 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, row.pct)}%`, height: "100%", background: statusColor, transition: "width 0.4s" }} />
          </div>
          <span style={{ fontSize: 10, fontFamily: MONO, color: statusColor, minWidth: 36, textAlign: "right" }}>
            {Math.round(row.pct)}%
          </span>
        </div>
      </td>
      {/* TREND */}
      <td style={{ padding: "9px 10px", minWidth: 80 }}>
        {row.history.length >= 2 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 38 }}>
              <Sparkline data={row.history} color={row.color} height={18} id={`bt-${row.alloc.id}`} showArea={false} />
            </div>
            {row.trend !== null && (
              <span style={{
                fontSize: 9, fontFamily: MONO, letterSpacing: "0.06em",
                color: row.trend > 5 ? "var(--red)" : row.trend < -5 ? "var(--green)" : "var(--t4)",
              }}>
                {row.trend > 0 ? "↑" : row.trend < 0 ? "↓" : "·"}{Math.abs(row.trend).toFixed(0)}%
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 9, color: "var(--t4)", fontFamily: MONO, letterSpacing: "0.1em" }}>—</span>
        )}
      </td>
      {/* ROLLOVER */}
      <td style={{ padding: "9px 10px", textAlign: "center" }} onClick={e => { e.stopPropagation(); void onUpdateRollover(row.alloc.id, !row.alloc.rollover); }}>
        <span style={{
          width: 18, height: 10, display: "inline-block", borderRadius: 6,
          background: row.alloc.rollover ? "var(--blue-dim)" : "var(--surface2)",
          border: `1px solid ${row.alloc.rollover ? "var(--blue-border)" : "var(--border2)"}`,
          position: "relative", verticalAlign: "middle",
        }}>
          <span style={{
            position: "absolute", top: 1, left: row.alloc.rollover ? 9 : 1,
            width: 6, height: 6, borderRadius: "50%",
            background: row.alloc.rollover ? "var(--blue)" : "var(--t3)",
            transition: "left .15s",
          }} />
        </span>
      </td>
      {/* > arrow */}
      <td style={{ padding: "9px 10px", textAlign: "center", color: selected ? "var(--blue)" : "var(--t4)" }}>
        ›
      </td>
    </tr>
  );
}

function Th({ children, onClick, active, dir, align }: { children: React.ReactNode; onClick?: () => void; active?: boolean; dir?: SortDir; align?: "left"|"right"|"center" }) {
  return (
    <th
      onClick={onClick}
      style={{
        textAlign: align ?? "right",
        padding: "10px 10px",
        fontWeight: 700, fontSize: 9, letterSpacing: "0.22em",
        color: active ? "var(--blue)" : "var(--t3)",
        fontFamily: MONO,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {children}
      {active && <span style={{ marginLeft: 4 }}>{dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}
