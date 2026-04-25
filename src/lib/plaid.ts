import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;

const config = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET":    process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(config);

export function plaidConfigured() {
  return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

/**
 * Normalize Plaid's raw account type/subtype into our internal account_type.
 *
 * Plaid `type` is one of: depository | credit | loan | investment | brokerage | other
 * Plaid `subtype` is finer (checking, savings, credit card, mortgage, etc.).
 *
 * We collapse to: checking | savings | credit | loan | investment | cash | other.
 * Used everywhere in the new Finance UI for type-aware grouping, color coding,
 * and net-worth math (debts subtract, assets add).
 */
export function normalizeAccountType(type: string | null | undefined, subtype: string | null | undefined): string {
  const t = (type ?? "").toLowerCase();
  const s = (subtype ?? "").toLowerCase();

  if (t === "depository") {
    if (s === "checking") return "checking";
    if (s === "savings" || s === "hsa" || s === "cd" || s === "money market") return "savings";
    if (s === "cash management") return "cash";
    return "checking";
  }
  if (t === "credit") return "credit";
  if (t === "loan")   return "loan";
  if (t === "investment" || t === "brokerage") return "investment";
  return "other";
}

/** Whether an account_type contributes positively (asset) vs negatively (debt). */
export function isLiabilityAccount(account_type: string): boolean {
  return account_type === "credit" || account_type === "loan";
}
