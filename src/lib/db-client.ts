/**
 * Drop-in chainable client for dashboard write paths.
 *
 * Usage mirrors @supabase/supabase-js:
 *   await dbWrite.from("tasks").insert({...}).select().single()
 *   await dbWrite.from("tasks").update({...}).eq("id", id)
 *   await dbWrite.from("habit_logs").upsert({...}, { onConflict: "habit_id,date" })
 *   await dbWrite.from("bills").delete().neq("name", "NEVER")
 *
 * Only writes (insert/update/upsert/delete). Reads continue to use the
 * supabase client directly — anon read is intentionally still permitted
 * by RLS on dashboard-visible tables.
 */

type WriteOp = "insert" | "update" | "upsert" | "delete";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Values = any;

interface WriteResult<T = unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: { message: string } | null;
  _t?: T;
}

class WriteChain<T = unknown> implements PromiseLike<WriteResult<T>> {
  private op: WriteOp | null = null;
  private values: Values = undefined;
  private matches: Record<string, unknown> = {};
  private notMatches: Record<string, unknown> = {};
  private onConflict?: string;
  private selectCols?: string;
  private wantSingle = false;

  constructor(private table: string) {}

  insert(values: Values): this { this.op = "insert"; this.values = values; return this; }
  update(values: Values): this { this.op = "update"; this.values = values; return this; }
  upsert(values: Values, opts?: { onConflict?: string }): this {
    this.op = "upsert"; this.values = values;
    if (opts?.onConflict) this.onConflict = opts.onConflict;
    return this;
  }
  delete(): this { this.op = "delete"; return this; }

  eq(col: string, val: unknown): this { this.matches[col] = val; return this; }
  neq(col: string, val: unknown): this { this.notMatches[col] = val; return this; }

  select(cols: string = "*"): this { this.selectCols = cols; return this; }

  // .single() in supabase returns a result, ending the chain
  async single(): Promise<WriteResult<T>> {
    this.wantSingle = true;
    return this.execute();
  }

  private async execute(): Promise<WriteResult<T>> {
    try {
      const r = await fetch("/api/db/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: this.table,
          op: this.op,
          values: this.values,
          match: Object.keys(this.matches).length ? this.matches : undefined,
          notMatch: Object.keys(this.notMatches).length ? this.notMatches : undefined,
          onConflict: this.onConflict,
          returnSelect: this.selectCols,
          returnSingle: this.wantSingle || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) return { data: null, error: { message: j.error ?? `HTTP ${r.status}` } };
      return { data: j.data ?? null, error: null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
    }
  }

  // Awaitable directly (await dbWrite.from("x").update(y).eq("id",z))
  then<R1 = WriteResult<T>, R2 = never>(
    onFulfilled?: ((v: WriteResult<T>) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onFulfilled, onRejected);
  }
}

export const dbWrite = {
  from<T = unknown>(table: string) { return new WriteChain<T>(table); },
};
