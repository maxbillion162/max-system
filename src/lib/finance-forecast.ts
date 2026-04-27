/**
 * Finance projection math — pure functions, no I/O, no React.
 *
 * Shared by /api/finance/forecast, /api/finance/whatif, the CashFlowForecast
 * chart, the NetWorthSimulator (time-travel), and the WhatIfEngine card.
 *
 * The model:
 *   - we read 90 days of past transactions to derive a daily burn rate + daily
 *     income rate (Plaid sign convention: positive = outflow, negative = inflow)
 *   - net daily flow = income_rate - burn_rate
 *   - we project forward N days starting from today's `liquid_cash` baseline
 *   - knobs let callers override flows (cancel subs, raise savings rate, salary
 *     change date) without forking the whole projection
 */
import type { Transaction, WealthSnapshot } from "@/types/finance";

export interface ProjectionKnobs {
  /** Add this much to monthly net savings (positive = saves more, negative = saves less) */
  monthly_savings_delta?: number;
  /** Cancel these merchants' recurring charges starting today */
  cancel_subscriptions?: string[];
  /** Apply a one-time salary change starting on this date (ISO yyyy-mm-dd) */
  salary_change?: { effective_date: string; new_monthly: number };
  /** BTC price assumption ($) at end of horizon — linear path from current */
  btc_price_target?: number;
  /** Current BTC holdings in coins (caller passes — kept here for symmetry) */
  btc_amount_coins?: number;
}

export interface DailyPoint {
  date:        string;     // yyyy-mm-dd
  cash:        number;     // projected liquid cash
  net_worth?:  number;     // optional — when caller supplies asset projections
  is_actual:   boolean;
  milestone?:  string;     // e.g. "Emergency fund $10K" — set on the day a goal hits
}

export interface ForecastResult {
  past:           DailyPoint[];
  future:         DailyPoint[];
  daily_burn:     number;
  daily_income:   number;
  daily_net:      number;
  recurring_total_monthly: number;
  baseline_cash:  number;
  horizon_days:   number;
}

/**
 * Compute daily burn (avg outflows/day) and daily income (avg inflows/day)
 * over the supplied transactions. Returns 0/0 when history is too short.
 */
export function deriveDailyRates(txs: Transaction[]): { burn: number; income: number; daysSpan: number } {
  const filtered = txs.filter(t => !t.pending);
  if (filtered.length < 5) return { burn: 0, income: 0, daysSpan: 0 };

  const dates    = filtered.map(t => new Date(t.date + "T12:00:00").getTime());
  const earliest = Math.min(...dates);
  const latest   = Math.max(...dates);
  const daysSpan = Math.max(1, Math.round((latest - earliest) / 86_400_000));
  if (daysSpan < 14) return { burn: 0, income: 0, daysSpan };

  const outflowTotal = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const inflowTotal  = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return {
    burn:   outflowTotal / daysSpan,
    income: inflowTotal  / daysSpan,
    daysSpan,
  };
}

/**
 * Walk back through the transaction log from today to reconstruct the daily
 * cash trail. We don't have hourly snapshots, so we anchor at today's
 * `currentCash` and subtract net flow per day going backwards.
 */
export function pastCashSeries(
  currentCash: number,
  txs: Transaction[],
  days = 90,
): DailyPoint[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const out: DailyPoint[] = [];

  // Bucket transactions by date.
  const byDay: Record<string, number> = {};   // net flow that day (positive = cash leaving)
  for (const t of txs) {
    if (t.pending) continue;
    byDay[t.date] = (byDay[t.date] ?? 0) + t.amount;
  }

  let running = currentCash;
  for (let i = 0; i <= days; i++) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, cash: Math.round(running), is_actual: true });
    running += byDay[iso] ?? 0;  // walking backwards: undo today's net flow to get yesterday's
  }

  return out.reverse();
}

/**
 * Project cash forward N days from today using daily rates + knobs.
 * Recurring charges are blended into the burn rate; cancelling subs
 * reduces it dollar-for-dollar (avg per day).
 */
export function projectFuture(
  baselineCash:           number,
  dailyBurn:              number,
  dailyIncome:            number,
  recurring:              { merchant: string; monthly_amount: number }[],
  knobs:                  ProjectionKnobs,
  horizonDays:            number,
  goalMilestones:         { label: string; target: number; field: "cash" }[] = [],
): DailyPoint[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // Start with the per-day income/burn we observed, then apply knobs.
  let adjIncome = dailyIncome;
  let adjBurn   = dailyBurn;

  if (knobs.monthly_savings_delta) {
    // savings delta is positive when Max wants to save MORE — model it as reduced burn.
    adjBurn -= knobs.monthly_savings_delta / 30;
  }

  if (knobs.cancel_subscriptions?.length) {
    const cancelDaily = recurring
      .filter(r => knobs.cancel_subscriptions!.includes(r.merchant))
      .reduce((s, r) => s + r.monthly_amount / 30, 0);
    adjBurn -= cancelDaily;
  }

  const out: DailyPoint[] = [];
  let cash = baselineCash;
  const milestonesHit = new Set<string>();

  for (let i = 1; i <= horizonDays; i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);

    // Salary change kicks in on its effective date — we shift the income rate.
    let dayIncome = adjIncome;
    if (knobs.salary_change && iso >= knobs.salary_change.effective_date) {
      dayIncome = knobs.salary_change.new_monthly / 30;
    }

    cash += dayIncome - adjBurn;

    // Stamp first day each goal threshold is crossed.
    let milestone: string | undefined;
    for (const m of goalMilestones) {
      if (milestonesHit.has(m.label)) continue;
      if (cash >= m.target) {
        milestone = m.label;
        milestonesHit.add(m.label);
      }
    }

    out.push({ date: iso, cash: Math.round(cash), is_actual: false, milestone });
  }

  return out;
}

/**
 * Simple net-worth simulator — projects net worth (not just cash) forward
 * by applying daily savings to liquid + a linear BTC price ramp.
 * Returns one DailyPoint per day with a populated `net_worth`.
 */
export function simulateNetWorth(opts: {
  baseline_net_worth: number;
  baseline_cash:      number;
  baseline_btc_value: number;
  baseline_other:     number;          // savings + investment + ira − debt
  daily_net_flow:     number;          // (income - burn) per day
  btc_price_now:      number;
  btc_amount_coins:   number;
  knobs:              ProjectionKnobs;
  horizon_days:       number;
}): DailyPoint[] {
  const {
    baseline_cash, baseline_other,
    daily_net_flow, btc_price_now, btc_amount_coins,
    knobs, horizon_days,
  } = opts;

  // Effective daily savings under the knobs.
  let dailySavings = daily_net_flow;
  if (knobs.monthly_savings_delta) dailySavings += knobs.monthly_savings_delta / 30;

  // BTC price path — linear interpolation if a target was supplied.
  const btcStart  = btc_price_now;
  const btcTarget = knobs.btc_price_target ?? btc_price_now;

  const today = new Date(); today.setHours(12, 0, 0, 0);
  const out: DailyPoint[] = [];
  let cash = baseline_cash;

  for (let i = 1; i <= horizon_days; i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);

    // Salary change override (apply to daily flow once we cross effective_date)
    let flow = dailySavings;
    if (knobs.salary_change && iso >= knobs.salary_change.effective_date) {
      flow = (knobs.salary_change.new_monthly / 30) - (daily_net_flow < 0 ? 0 : 0);
      // We just override income — keep the same burn that was baked in.
    }

    cash += flow;

    const btcPriceToday = btcStart + ((btcTarget - btcStart) * (i / horizon_days));
    const btcValue      = btcPriceToday * btc_amount_coins;
    const netWorth      = cash + baseline_other + btcValue;

    out.push({ date: iso, cash: Math.round(cash), net_worth: Math.round(netWorth), is_actual: false });
  }
  return out;
}

/**
 * Convenience: assemble a full ForecastResult from raw inputs.
 */
export function buildForecast(opts: {
  current_cash:    number;
  transactions:    Transaction[];
  recurring:       { merchant: string; monthly_amount: number }[];
  knobs:           ProjectionKnobs;
  horizon_days?:   number;
  goal_milestones?: { label: string; target: number; field: "cash" }[];
}): ForecastResult {
  const horizon = opts.horizon_days ?? 90;
  const { burn, income } = deriveDailyRates(opts.transactions);

  const past   = pastCashSeries(opts.current_cash, opts.transactions, 90);
  const future = projectFuture(
    opts.current_cash,
    burn,
    income,
    opts.recurring,
    opts.knobs,
    horizon,
    opts.goal_milestones ?? [],
  );

  return {
    past,
    future,
    daily_burn:              Math.round(burn * 100) / 100,
    daily_income:            Math.round(income * 100) / 100,
    daily_net:               Math.round((income - burn) * 100) / 100,
    recurring_total_monthly: opts.recurring.reduce((s, r) => s + r.monthly_amount, 0),
    baseline_cash:           opts.current_cash,
    horizon_days:            horizon,
  };
}

/**
 * Pull the latest cash baseline from a wealth_history series — caller may
 * already have this from F1, exported here for any consumer that doesn't.
 */
export function latestCashFromSnapshots(snapshots: WealthSnapshot[]): number {
  if (snapshots.length === 0) return 0;
  const sorted = [...snapshots].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  return sorted[0].cash ?? sorted[0].savings ?? 0;
}
