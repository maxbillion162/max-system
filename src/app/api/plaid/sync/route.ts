import { NextResponse } from "next/server";
import { plaidClient, plaidConfigured } from "@/lib/plaid";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST() {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: "Plaid not configured" }, { status: 503 });
  }

  try {
    const { data: accounts } = await supabase
      .from("accounts")
      .select("*")
      .eq("active", true);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: "No accounts connected", synced: 0 });
    }

    // Deduplicate by access token (one Plaid item = one institution)
    const itemMap = new Map<string, { access_token: string }>();
    for (const acct of accounts) {
      if (!itemMap.has(acct.plaid_item_id)) {
        itemMap.set(acct.plaid_item_id, { access_token: acct.plaid_access_token });
      }
    }

    const now = new Date().toISOString();
    const endDate   = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    let totalTransactions = 0;

    for (const { access_token } of itemMap.values()) {
      // Sync balances
      const balRes = await plaidClient.accountsBalanceGet({ access_token });
      for (const acct of balRes.data.accounts) {
        await supabase
          .from("accounts")
          .update({
            current_balance:   acct.balances.current,
            available_balance: acct.balances.available,
            last_synced: now,
          })
          .eq("plaid_account_id", acct.account_id);
      }

      // Sync transactions (last 90 days)
      const txRes = await plaidClient.transactionsGet({
        access_token,
        start_date: startDate,
        end_date: endDate,
        options: { count: 500 },
      });

      const txs = txRes.data.transactions;
      totalTransactions += txs.length;

      for (const tx of txs) {
        await supabase.from("transactions").upsert({
          plaid_transaction_id: tx.transaction_id,
          date:                tx.date,
          amount:              tx.amount,
          merchant:            tx.merchant_name ?? tx.name,
          merchant_normalized: (tx.merchant_name ?? tx.name).toLowerCase().trim(),
          category:            (tx as { personal_finance_category?: { primary?: string } }).personal_finance_category?.primary ?? "Uncategorized",
          plaid_category:      tx.category?.join(" > ") ?? null,
          source:              "plaid",
          account_id:          tx.account_id,
          pending:             tx.pending,
        }, { onConflict: "plaid_transaction_id" });
      }
    }

    return NextResponse.json({ success: true, synced: totalTransactions, at: now });
  } catch (err) {
    console.error("Plaid sync error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
