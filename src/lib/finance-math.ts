/**
 * Pure finance calculations — no I/O, no React.
 * Used by the new Finance page components and APIs.
 */

import type { Transaction, WealthSnapshot, Account, AssetBreakdown } from "@/types/finance";
import { isLiabilityAccount } from "@/lib/plaid";

/**
 * Compute cash-flow runway in days at current burn rate.
 *
 * Inputs:
 *   - liquidCash: combined checking + savings + cash balances available right now
 *   - transactions90d: last 90 days of (positive-amount) outflows from Plaid
 *
 * Returns null when there's not enough history (<14 days of transactions) —
 * the UI can render a "building history…" state.
 */
export function cashFlowRunway(liquidCash: number, transactions90d: Transaction[]): number | null {
  // Plaid convention: positive amount = outflow (debit), negative = inflow (credit)
  const outflows = transactions90d.filter(t => t.amount > 0 && !t.pending);
  if (outflows.length < 5) return null;

  const dates = outflows.map(t => new Date(t.date).getTime());
  const earliest = Math.min(...dates);
  const latest   = Math.max(...dates);
  const daysSpan = Math.max(1, Math.round((latest - earliest) / 86_400_000));
  if (daysSpan < 14) return null;

  const totalSpend = outflows.reduce((s, t) => s + t.amount, 0);
  const dailyBurn  = totalSpend / daysSpan;
  if (dailyBurn <= 0) return null;

  return Math.max(0, Math.floor(liquidCash / dailyBurn));
}

/**
 * Compute net worth + asset breakdown from accounts + crypto + IRA holdings.
 * Crypto value comes from external price data — the caller passes the dollar total.
 */
export function netWorthBreakdown(
  accounts: Account[],
  cryptoUsd: number,
  iraUsd: number,
): AssetBreakdown {
  let cash = 0, savings = 0, investmentBank = 0, debt = 0;

  for (const a of accounts) {
    if (a.archived) continue;
    const bal = a.current_balance ?? 0;
    if (isLiabilityAccount(a.account_type)) {
      debt += Math.abs(bal);
    } else if (a.account_type === "checking" || a.account_type === "cash") {
      cash += bal;
    } else if (a.account_type === "savings") {
      savings += bal;
    } else if (a.account_type === "investment") {
      investmentBank += bal;
    }
  }

  const investment = investmentBank + iraUsd;
  const net_worth = cash + savings + investment + cryptoUsd - debt;

  return {
    cash,
    savings,
    crypto: cryptoUsd,
    investment,
    debt,
    net_worth,
  };
}

/**
 * Compute 24-hour delta (and percent) from wealth_history snapshots.
 * Returns { delta: 0, pct: 0 } when there isn't a snapshot from ~24h ago.
 */
export function delta24h(history: WealthSnapshot[], currentNetWorth: number): { delta: number; pct: number } {
  if (history.length === 0) return { delta: 0, pct: 0 };
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  // Find the snapshot closest to (now - 24h)
  const target = now - oneDay;
  const sorted = [...history].sort((a, b) =>
    Math.abs(new Date(a.recorded_at).getTime() - target) - Math.abs(new Date(b.recorded_at).getTime() - target)
  );
  const ref = sorted[0];
  if (!ref) return { delta: 0, pct: 0 };
  const refMs = new Date(ref.recorded_at).getTime();
  // Reject if the closest snapshot is more than 36h away (no real 24h reading available)
  if (Math.abs(refMs - target) > 36 * 60 * 60 * 1000) return { delta: 0, pct: 0 };
  const delta = currentNetWorth - ref.net_worth;
  const pct = ref.net_worth ? (delta / ref.net_worth) * 100 : 0;
  return { delta, pct };
}
