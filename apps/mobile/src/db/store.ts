import type { Customer, Expense, ExpenseCategory, Order, OrderLine, Payment } from "@embroidery/ledger";
import { supabase } from "./supabase";

/**
 * In-memory copy of the whole ledger, loaded from Supabase at sign-in and
 * refreshed when the tab regains focus. Screens read it synchronously (the
 * business is a few hundred rows); every write updates memory first, then is
 * queued to Supabase in order. If the network is down the queue keeps
 * retrying, and `syncState` tells the UI.
 */

export interface Design {
  id: string;
  name: string;
  stitches: number;
  defaultPrice: number;
  defaultCost: number;
  notes: string;
  lastUsedAt: string | null;
  createdAt: string;
}
export interface Setting {
  key: string;
  value: string;
}

export interface Tables {
  customer: Customer[];
  order: Order[];
  order_line: OrderLine[];
  payment: Payment[];
  expense_category: ExpenseCategory[];
  expense: Expense[];
  design: Design[];
  setting: Setting[];
}
export type TableName = keyof Tables;
type Row<T extends TableName> = Tables[T][number];

const TABLES: TableName[] = ["customer", "order", "order_line", "payment", "expense_category", "expense", "design", "setting"];
const PK: Record<TableName, string> = {
  customer: "id",
  order: "id",
  order_line: "id",
  payment: "id",
  expense_category: "id",
  expense: "id",
  design: "id",
  setting: "key",
};

export const store: Tables = {
  customer: [],
  order: [],
  order_line: [],
  payment: [],
  expense_category: [],
  expense: [],
  design: [],
  setting: [],
};

// ---------------------------------------------------------------------------
// Change notification

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify(): void {
  for (const l of listeners) l();
}

// ---------------------------------------------------------------------------
// camelCase <-> snake_case (column names in Postgres are snake_case)

const toSnake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
function snakeRow(row: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toSnake(k)] = v;
  return out;
}
function camelRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

// ---------------------------------------------------------------------------
// Load

let loadedAt = 0;
export async function loadAll(): Promise<void> {
  const results = await Promise.all(
    TABLES.map(async (t) => {
      const { data, error } = await supabase.from(t).select("*");
      if (error) throw new Error(`${t}: ${error.message}`);
      return [t, (data ?? []).map((r) => camelRow(r as Record<string, unknown>))] as const;
    }),
  );
  for (const [t, rows] of results) (store[t] as unknown[]) = rows;
  loadedAt = Date.now();
  notify();
}

/** Refresh if it's been a while; called when the tab/app regains focus. */
export async function refreshIfStale(maxAgeMs = 20_000): Promise<void> {
  if (Date.now() - loadedAt < maxAgeMs || pending.length > 0) return;
  try {
    await loadAll();
  } catch {
    // offline; keep what we have
  }
}

// ---------------------------------------------------------------------------
// Writes: memory first, then queued to the server in order.

type Op =
  | { kind: "upsert"; table: TableName; row: Record<string, unknown> }
  | { kind: "delete"; table: TableName; column: string; value: string };

const pending: Op[] = [];
export type SyncState = "idle" | "syncing" | "error";
export let syncState: SyncState = "idle";
export let syncError = "";
let flushing = false;

function setSync(s: SyncState, err = ""): void {
  if (s !== syncState || err !== syncError) {
    syncState = s;
    syncError = err;
    notify();
  }
}

async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  let delay = 1000;
  while (pending.length > 0) {
    const op = pending[0]!;
    setSync("syncing");
    const { error } =
      op.kind === "upsert"
        ? await supabase.from(op.table).upsert(op.row)
        : await supabase.from(op.table).delete().eq(op.column, op.value);
    if (error) {
      setSync("error", error.message);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 30_000);
      continue;
    }
    pending.shift();
    delay = 1000;
  }
  flushing = false;
  setSync("idle");
}

export function upsert<T extends TableName>(table: T, row: Row<T>): void {
  const pk = PK[table] as keyof Row<T>;
  const arr = store[table] as Row<T>[];
  const i = arr.findIndex((r) => r[pk] === row[pk]);
  if (i >= 0) arr[i] = row;
  else arr.push(row);
  pending.push({ kind: "upsert", table, row: snakeRow(row) });
  notify();
  void flush();
}

export function removeWhere<T extends TableName>(table: T, column: keyof Row<T> & string, value: string): void {
  const arr = store[table] as Row<T>[];
  (store[table] as Row<T>[]) = arr.filter((r) => r[column] !== value);
  pending.push({ kind: "delete", table, column: toSnake(column), value });
  notify();
  void flush();
}

export function remove<T extends TableName>(table: T, id: string): void {
  removeWhere(table, PK[table] as keyof Row<T> & string, id);
}

/** Run several writes, then notify listeners once. */
export function batch(fn: () => void): void {
  const saved = new Set(listeners);
  listeners.clear();
  try {
    fn();
  } finally {
    for (const l of saved) listeners.add(l);
    notify();
  }
}

export function pendingWrites(): number {
  return pending.length;
}
