import { NextResponse } from "next/server";
import { plaidClient, plaidConfigured, normalizeAccountType } from "@/lib/plaid";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PlaidAccount {
  id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype: string;
  mask?: string;
}

interface PlaidInstitution {
  name: string;
  institution_id: string;
}

export async function POST(req: Request) {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: "Plaid not configured" }, { status: 503 });
  }

  try {
    const { public_token, institution, accounts } = await req.json() as {
      public_token: string;
      institution: PlaidInstitution;
      accounts: PlaidAccount[];
    };

    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeRes.data;

    for (const account of accounts) {
      await supabase.from("accounts").upsert({
        plaid_account_id: account.id,
        plaid_access_token: access_token,
        plaid_item_id: item_id,
        name: account.name,
        official_name: account.official_name ?? null,
        type: account.type,
        subtype: account.subtype,
        account_type: normalizeAccountType(account.type, account.subtype),
        institution: institution.name,
        mask: account.mask ?? null,
        active: true,
        archived: false,
      }, { onConflict: "plaid_account_id" });
    }

    return NextResponse.json({ success: true, accounts_added: accounts.length });
  } catch (err) {
    console.error("Plaid exchange error:", err);
    return NextResponse.json({ error: "Failed to exchange token" }, { status: 500 });
  }
}
