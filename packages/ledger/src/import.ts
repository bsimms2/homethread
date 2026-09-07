import { parseMoney } from "./money";
import type { Cents, IsoDate, OrderStatus, PaymentMethod } from "./types";

/**
 * CSV import for getting history into the app: designs, expenses and orders.
 * Pure parsing and validation; the app decides how to store the results.
 *
 * Every imported thing carries a `key` built from its identifying columns so
 * the app can derive a stable id and re-importing the same file updates rows
 * instead of duplicating them.
 */

// ---------------------------------------------------------------------------
// CSV

/** RFC-4180-ish: quoted fields, doubled quotes, CRLF or LF. Blank lines skipped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.startsWith("﻿") ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Map header aliases to canonical field names. Unknown columns are kept under their normalized name. */
function canon(header: string, aliases: Record<string, string[]>): string {
  const n = norm(header);
  for (const [field, names] of Object.entries(aliases)) if (names.includes(n)) return field;
  return n;
}

export type Rec = Record<string, string>;

export function toRecords(rows: string[][], aliases: Record<string, string[]>): Rec[] {
  const [header, ...body] = rows;
  if (!header) return [];
  const fields = header.map((h) => canon(h, aliases));
  return body.map((r) => {
    const rec: Rec = {};
    fields.forEach((f, i) => {
      rec[f] = (r[i] ?? "").trim();
    });
    return rec;
  });
}

// ---------------------------------------------------------------------------
// Field parsers

const pad = (n: number) => String(n).padStart(2, "0");

/** Accepts 2026-09-05, 9/5/2026, 9/5/26, 2026/09/05, 09-05-2026. Null if unreadable. */
export function parseDate(s: string): IsoDate | null {
  const t = s.trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t);
  if (m) return check(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/.exec(t);
  if (m) {
    const yy = Number(m[3]);
    return check(yy < 100 ? 2000 + yy : yy, Number(m[1]), Number(m[2]));
  }
  return null;
}
function check(y: number, mo: number, d: number): IsoDate | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function parseStatus(s: string): OrderStatus | null {
  const n = norm(s);
  if (n === "") return null;
  if (["quote", "quoted"].includes(n)) return "quote";
  if (["confirmed", "open", "new", "ordered"].includes(n)) return "confirmed";
  if (["inprogress", "stitching", "started", "wip"].includes(n)) return "in_progress";
  if (["done", "ready", "finished", "complete", "completed"].includes(n)) return "done";
  if (["delivered", "pickedup", "shipped", "closed", "paid"].includes(n)) return "delivered";
  if (["cancelled", "canceled", "void"].includes(n)) return "cancelled";
  return null;
}

export function parseMethod(s: string): PaymentMethod {
  const n = norm(s);
  if (n.includes("venmo")) return "venmo";
  if (n.includes("cash")) return "cash";
  return "other";
}

const int = (s: string): number => {
  const n = parseInt(s.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const money = (s: string): Cents => parseMoney(s) ?? 0;

export interface ImportError {
  row: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Designs

export const DESIGN_ALIASES: Record<string, string[]> = {
  name: ["name", "design", "designname", "title"],
  stitches: ["stitches", "stitchcount", "stitch", "count"],
  price: ["price", "usualprice", "defaultprice", "sell"],
  cost: ["cost", "blankcost", "usualcost", "defaultcost", "garmentcost"],
  notes: ["notes", "note", "comments"],
};

export interface DesignImport {
  key: string;
  name: string;
  stitches: number;
  defaultPrice: Cents;
  defaultCost: Cents;
  notes: string;
}

export function importDesigns(recs: Rec[]): { items: DesignImport[]; errors: ImportError[] } {
  const items: DesignImport[] = [];
  const errors: ImportError[] = [];
  recs.forEach((r, i) => {
    const name = r["name"] ?? "";
    if (!name) return errors.push({ row: i + 2, message: "missing name" });
    items.push({
      key: `design|${name.toLowerCase()}`,
      name,
      stitches: int(r["stitches"] ?? ""),
      defaultPrice: money(r["price"] ?? ""),
      defaultCost: money(r["cost"] ?? ""),
      notes: r["notes"] ?? "",
    });
  });
  return { items, errors };
}

// ---------------------------------------------------------------------------
// Expenses

export const EXPENSE_ALIASES: Record<string, string[]> = {
  date: ["date", "spenton", "purchased", "when"],
  vendor: ["vendor", "store", "shop", "merchant", "payee", "where"],
  amount: ["amount", "total", "paid", "cost"],
  tax: ["tax", "salestax"],
  category: ["category", "type", "cat"],
  note: ["note", "notes", "description", "items", "what", "memo"],
};

export interface ExpenseImport {
  key: string;
  vendor: string;
  spentOn: IsoDate;
  amount: Cents;
  tax: Cents;
  categoryName: string | null;
  note: string;
}

export function importExpenses(recs: Rec[]): { items: ExpenseImport[]; errors: ImportError[] } {
  const items: ExpenseImport[] = [];
  const errors: ImportError[] = [];
  recs.forEach((r, i) => {
    const row = i + 2;
    const spentOn = parseDate(r["date"] ?? "");
    if (!spentOn) return errors.push({ row, message: `bad or missing date "${r["date"] ?? ""}"` });
    const amount = money(r["amount"] ?? "");
    if (amount <= 0) return errors.push({ row, message: `bad or missing amount "${r["amount"] ?? ""}"` });
    const vendor = r["vendor"] || "Unknown vendor";
    const note = r["note"] ?? "";
    items.push({
      key: `expense|${spentOn}|${vendor.toLowerCase()}|${amount}|${note.toLowerCase()}`,
      vendor,
      spentOn,
      amount,
      tax: money(r["tax"] ?? ""),
      categoryName: r["category"] || null,
      note,
    });
  });
  return { items, errors };
}

// ---------------------------------------------------------------------------
// Orders: one row per item. Rows with the same order ref (or, with no ref,
// the same customer + order date) become one order with several items.

export const ORDER_ALIASES: Record<string, string[]> = {
  ref: ["order", "ref", "orderid", "orderno", "ordernumber", "id", "invoice"],
  customer: ["customer", "name", "client", "who", "customername"],
  ordered: ["ordered", "date", "orderdate", "orderedon"],
  due: ["due", "duedate", "dueon", "needed"],
  status: ["status", "stage"],
  item: ["item", "description", "design", "product", "what"],
  qty: ["qty", "quantity", "count", "pieces"],
  price: ["price", "priceeach", "unitprice", "each", "sell"],
  cost: ["cost", "costeach", "unitcost", "blankcost"],
  stitches: ["stitches", "stitchcount"],
  paid: ["paid", "paidamount", "payment", "received", "amountpaid"],
  method: ["method", "paidmethod", "paidvia", "how", "paymentmethod"],
  paidon: ["paidon", "paiddate", "paymentdate", "datepaid"],
  notes: ["notes", "note", "comments", "memo"],
};

export interface OrderImport {
  key: string;
  customerName: string;
  orderedOn: IsoDate;
  dueOn: IsoDate | null;
  status: OrderStatus;
  notes: string;
  lines: { description: string; qty: number; unitPrice: Cents; unitCost: Cents; stitches: number | null }[];
  payment: { amount: Cents; method: PaymentMethod; receivedOn: IsoDate } | null;
}

/**
 * Status defaults to "delivered" when blank: history being imported is, by
 * definition, done. A blank paid column means unpaid; "paid" in the status
 * column means paid in full on the order date.
 */
export function importOrders(recs: Rec[]): { items: OrderImport[]; errors: ImportError[] } {
  const byKey = new Map<string, OrderImport>();
  const errors: ImportError[] = [];
  recs.forEach((r, i) => {
    const row = i + 2;
    const customer = r["customer"] ?? "";
    const orderedOn = parseDate(r["ordered"] ?? "");
    if (!orderedOn) return errors.push({ row, message: `bad or missing order date "${r["ordered"] ?? ""}"` });
    const ref = r["ref"] ?? "";
    const key = ref ? `order|ref|${ref.toLowerCase()}` : `order|${customer.toLowerCase()}|${orderedOn}`;
    const description = r["item"] ?? "";
    const price = money(r["price"] ?? "");
    if (!description && price === 0) return errors.push({ row, message: "row has no item and no price" });
    const qty = Math.max(1, int(r["qty"] ?? "") || 1);
    const stitchesRaw = r["stitches"] ?? "";

    let o = byKey.get(key);
    if (!o) {
      const rawStatus = r["status"] ?? "";
      const status = parseStatus(rawStatus) ?? "delivered";
      if (rawStatus && !parseStatus(rawStatus)) errors.push({ row, message: `unknown status "${rawStatus}", used delivered` });
      o = {
        key,
        customerName: customer,
        orderedOn,
        dueOn: parseDate(r["due"] ?? ""),
        status,
        notes: r["notes"] ?? "",
        lines: [],
        payment: null,
      };
      byKey.set(key, o);
    } else if (r["notes"] && !o.notes.includes(r["notes"])) {
      o.notes = o.notes ? `${o.notes}\n${r["notes"]}` : r["notes"];
    }
    o.lines.push({
      description,
      qty,
      unitPrice: price,
      unitCost: money(r["cost"] ?? ""),
      stitches: stitchesRaw ? int(stitchesRaw) : null,
    });

    // Payment: first row of an order that carries one wins; "paid" status = full.
    const paid = money(r["paid"] ?? "");
    if (paid > 0 && !o.payment) {
      o.payment = { amount: paid, method: parseMethod(r["method"] ?? ""), receivedOn: parseDate(r["paidon"] ?? "") ?? orderedOn };
    }
  });
  // "paid" in the status column means settled in full.
  recs.forEach((r) => {
    if (norm(r["status"] ?? "") !== "paid") return;
    const ref = r["ref"] ?? "";
    const orderedOn = parseDate(r["ordered"] ?? "");
    if (!orderedOn) return;
    const key = ref ? `order|ref|${ref.toLowerCase()}` : `order|${(r["customer"] ?? "").toLowerCase()}|${orderedOn}`;
    const o = byKey.get(key);
    if (o && !o.payment) {
      const total = o.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
      if (total > 0) o.payment = { amount: total, method: parseMethod(r["method"] ?? ""), receivedOn: parseDate(r["paidon"] ?? "") ?? orderedOn };
    }
  });
  return { items: [...byKey.values()], errors };
}

// ---------------------------------------------------------------------------
// Detection

export type CsvKind = "designs" | "expenses" | "orders";

/** Guess what a CSV holds from its header row. Null if it looks like none of them. */
export function detectCsvKind(header: string[]): CsvKind | null {
  const h = new Set(header.map(norm));
  const has = (aliases: Record<string, string[]>, field: string) => aliases[field]?.some((a) => h.has(a)) ?? false;
  if (has(ORDER_ALIASES, "customer") && (has(ORDER_ALIASES, "item") || has(ORDER_ALIASES, "price")) && has(ORDER_ALIASES, "ordered"))
    return "orders";
  if (has(EXPENSE_ALIASES, "vendor") && has(EXPENSE_ALIASES, "amount")) return "expenses";
  if (has(DESIGN_ALIASES, "name") && has(DESIGN_ALIASES, "stitches")) return "designs";
  if (has(EXPENSE_ALIASES, "date") && has(EXPENSE_ALIASES, "amount")) return "expenses";
  return null;
}

export interface CsvImport {
  kind: CsvKind;
  designs: DesignImport[];
  expenses: ExpenseImport[];
  orders: OrderImport[];
  errors: ImportError[];
}

export function importCsv(text: string): CsvImport {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) throw new Error("The file is empty.");
  const kind = detectCsvKind(header);
  if (!kind)
    throw new Error(
      "Couldn't tell what this file holds. Designs need name + stitches; expenses need date + vendor + amount; orders need customer + date + item.",
    );
  const out: CsvImport = { kind, designs: [], expenses: [], orders: [], errors: [] };
  if (kind === "designs") {
    const r = importDesigns(toRecords(rows, DESIGN_ALIASES));
    out.designs = r.items;
    out.errors = r.errors;
  } else if (kind === "expenses") {
    const r = importExpenses(toRecords(rows, EXPENSE_ALIASES));
    out.expenses = r.items;
    out.errors = r.errors;
  } else {
    const r = importOrders(toRecords(rows, ORDER_ALIASES));
    out.orders = r.items;
    out.errors = r.errors;
  }
  return out;
}
