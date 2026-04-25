/**
 * Shared finance types — used across components, API routes, and finance libs.
 * Keep this file the single source of truth for the data shapes the new
 * Finance pages depend on.
 */

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "loan"
  | "investment"
  | "cash"
  | "other";

export interface Account {
  plaid_account_id:   string;
  plaid_item_id:      string;
  name:               string;
  official_name?:     string | null;
  institution?:       string | null;
  mask?:              string | null;
  type:               string | null;          // Plaid raw
  subtype:            string | null;          // Plaid raw
  account_type:       AccountType;            // our normalized
  current_balance:    number | null;
  available_balance:  number | null;
  last_synced:        string | null;
  active:             boolean;
  archived:           boolean;
}

export interface Transaction {
  id?:                  number | string;
  plaid_transaction_id: string;
  date:                 string;
  amount:               number;
  merchant:             string;
  merchant_normalized?: string;
  category:             string;
  budget_category?:     string | null;
  plaid_category?:      string | null;
  source:               string;
  account_id?:          string;
  pending?:             boolean;
}

export interface WealthSnapshot {
  recorded_at:   string;
  net_worth:     number;
  crypto_total:  number;
  ira_total:     number;
  savings:       number;
  cash?:         number;
  debt?:         number;
}

export interface AssetBreakdown {
  cash:        number;
  savings:     number;
  crypto:      number;
  investment:  number;
  debt:        number;       // negative contribution to net worth (positive number, subtracted)
  net_worth:   number;
}

export type ChartPeriod = "1M" | "3M" | "YTD" | "1Y" | "ALL";

export interface BudgetCategory {
  category:   string;
  budgeted:   number;
  spent:      number;
  remaining:  number;
  rollover?:  boolean;
}

export interface BudgetStatus {
  totalBudgeted: number;
  totalSpent:    number;
  readyToAssign: number;
  categories:    BudgetCategory[];
  income?:       number;
}

export interface Bill {
  id:             string;
  name:           string;
  amt:            number;
  due_day:        number;
  recurrence?:    "monthly" | "quarterly" | "annual" | "one-time" | "custom";
  next_due_date?: string | null;
  category?:      string | null;
  active?:        boolean;
}
