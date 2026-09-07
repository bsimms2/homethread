import type {
  Customer,
  Expense,
  ExpenseCategory,
  Order,
  OrderLine,
  OrderStatus,
  Payment,
} from "@embroidery/ledger";
import { newId, nowIso } from "../domain/ids";
import { batch, remove, removeWhere, store, upsert, type Design } from "./store";

export type { Design } from "./store";

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

// ---------------------------------------------------------------------------
// Whole-ledger reads. Sorted the way the lists want them.

export function allOrders(): Order[] {
  return [...store.order].sort((a, b) => b.orderedOn.localeCompare(a.orderedOn) || b.createdAt.localeCompare(a.createdAt));
}
export function allLines(): OrderLine[] {
  return [...store.order_line].sort((a, b) => a.position - b.position);
}
export function allPayments(): Payment[] {
  return [...store.payment].sort((a, b) => a.receivedOn.localeCompare(b.receivedOn));
}
export function allExpenses(): Expense[] {
  return [...store.expense].sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt));
}
export function allCustomers(): Customer[] {
  return [...store.customer].sort((a, b) => byText(a.name, b.name));
}
export function allCategories(): ExpenseCategory[] {
  return [...store.expense_category].sort((a, b) => a.position - b.position);
}

// ---------------------------------------------------------------------------
// Orders

export interface OrderBundle {
  order: Order;
  lines: OrderLine[];
  payments: Payment[];
}

export function getOrder(id: string): OrderBundle | null {
  const order = store.order.find((o) => o.id === id);
  if (!order) return null;
  return {
    order,
    lines: store.order_line.filter((l) => l.orderId === id).sort((a, b) => a.position - b.position),
    payments: store.payment.filter((p) => p.orderId === id).sort((a, b) => a.receivedOn.localeCompare(b.receivedOn)),
  };
}

export interface OrderDraft {
  id?: string;
  customerId: string | null;
  customerName: string;
  status: OrderStatus;
  orderedOn: string;
  dueOn: string | null;
  notes: string;
  lines: Omit<OrderLine, "id" | "orderId" | "position">[];
}

/** Insert or replace the order and its lines. Payments are untouched. */
export function saveOrder(draft: OrderDraft): string {
  const id = draft.id ?? newId();
  const now = nowIso();
  const existing = store.order.find((o) => o.id === id);
  batch(() => {
    upsert("order", {
      id,
      customerId: draft.customerId,
      customerName: draft.customerName,
      status: draft.status,
      orderedOn: draft.orderedOn,
      dueOn: draft.dueOn,
      notes: draft.notes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    removeWhere("order_line", "orderId", id);
    draft.lines.forEach((l, i) => {
      upsert("order_line", { id: newId(), orderId: id, position: i, ...l });
    });
  });
  return id;
}

export function setOrderStatus(id: string, status: OrderStatus): void {
  const o = store.order.find((x) => x.id === id);
  if (o) upsert("order", { ...o, status, updatedAt: nowIso() });
}

export function deleteOrder(id: string): void {
  batch(() => {
    // Postgres cascades lines and payments; mirror that in memory.
    (store.order_line as OrderLine[]) = store.order_line.filter((l) => l.orderId !== id);
    (store.payment as Payment[]) = store.payment.filter((p) => p.orderId !== id);
    remove("order", id);
  });
}

// ---------------------------------------------------------------------------
// Payments

export function addPayment(p: Omit<Payment, "id">): string {
  const id = newId();
  upsert("payment", { id, ...p });
  return id;
}

export function upsertPayment(p: Payment): void {
  upsert("payment", p);
}

export function deletePayment(id: string): void {
  remove("payment", id);
}

// ---------------------------------------------------------------------------
// Customers

export function saveCustomer(c: Omit<Customer, "id" | "createdAt"> & { id?: string }): string {
  const id = c.id ?? newId();
  const existing = store.customer.find((x) => x.id === id);
  upsert("customer", { id, name: c.name, contact: c.contact, notes: c.notes, createdAt: existing?.createdAt ?? nowIso() });
  return id;
}

/** Find by exact name (case-insensitive). Used by the order form's quick add. */
export function customerByName(name: string): Customer | null {
  const n = name.trim().toLowerCase();
  return store.customer.find((c) => c.name.trim().toLowerCase() === n) ?? null;
}

export function deleteCustomer(id: string): void {
  batch(() => {
    for (const o of store.order) if (o.customerId === id) upsert("order", { ...o, customerId: null });
    remove("customer", id);
  });
}

// ---------------------------------------------------------------------------
// Expenses

export function saveExpense(e: Omit<Expense, "id" | "createdAt"> & { id?: string; createdAt?: string }): string {
  const id = e.id ?? newId();
  const existing = store.expense.find((x) => x.id === id);
  upsert("expense", {
    id,
    vendor: e.vendor,
    spentOn: e.spentOn,
    amount: e.amount,
    tax: e.tax,
    categoryId: e.categoryId,
    note: e.note,
    receiptImagePath: e.receiptImagePath,
    extractionJson: e.extractionJson,
    createdAt: e.createdAt ?? existing?.createdAt ?? nowIso(),
  });
  return id;
}

export function getExpense(id: string): Expense | null {
  return store.expense.find((e) => e.id === id) ?? null;
}

export function deleteExpense(id: string): void {
  remove("expense", id);
}

/** Find a category by name (case-insensitive) or create it. */
export function categoryIdByName(name: string): string {
  const n = name.trim().toLowerCase();
  const found = store.expense_category.find((c) => c.name.trim().toLowerCase() === n);
  return found ? found.id : saveCategory(name);
}

export function saveCategory(name: string, id?: string): string {
  const cid = id ?? newId();
  const existing = store.expense_category.find((c) => c.id === cid);
  const max = store.expense_category.reduce((m, c) => Math.max(m, c.position), -1);
  upsert("expense_category", { id: cid, name: name.trim(), position: existing?.position ?? max + 1 });
  return cid;
}

// ---------------------------------------------------------------------------
// Designs

/** Most recently used first, then alphabetical, so the picker shows her regulars on top. */
export function allDesigns(): Design[] {
  return [...store.design].sort((a, b) => {
    if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
    if (a.lastUsedAt) return -1;
    if (b.lastUsedAt) return 1;
    return byText(a.name, b.name);
  });
}

export function saveDesign(d: Omit<Design, "id" | "createdAt" | "lastUsedAt"> & { id?: string; createdAt?: string; lastUsedAt?: string | null }): string {
  const id = d.id ?? newId();
  const existing = store.design.find((x) => x.id === id);
  upsert("design", {
    id,
    name: d.name.trim(),
    stitches: d.stitches,
    defaultPrice: d.defaultPrice,
    defaultCost: d.defaultCost,
    notes: d.notes,
    lastUsedAt: d.lastUsedAt ?? existing?.lastUsedAt ?? null,
    createdAt: d.createdAt ?? existing?.createdAt ?? nowIso(),
  });
  return id;
}

export function touchDesign(id: string): void {
  const d = store.design.find((x) => x.id === id);
  if (d) upsert("design", { ...d, lastUsedAt: nowIso() });
}

export function deleteDesign(id: string): void {
  remove("design", id);
}

// ---------------------------------------------------------------------------
// Settings (plain key/value)

export function getSetting(key: string): string | null {
  return store.setting.find((s) => s.key === key)?.value ?? null;
}
export function setSetting(key: string, value: string): void {
  upsert("setting", { key, value });
}

// ---------------------------------------------------------------------------
// Backup

export interface Backup {
  exportedAt: string;
  customers: Customer[];
  orders: Order[];
  lines: OrderLine[];
  payments: Payment[];
  categories: ExpenseCategory[];
  expenses: Expense[];
  designs: Design[];
}

export function exportAll(): string {
  const b: Backup = {
    exportedAt: nowIso(),
    customers: allCustomers(),
    orders: allOrders(),
    lines: allLines(),
    payments: allPayments(),
    categories: allCategories(),
    expenses: allExpenses(),
    designs: allDesigns(),
  };
  return JSON.stringify(b, null, 2);
}

/** Merge a backup in by id: rows in the file win, rows only in the database stay. */
export function restoreBackup(b: Backup): void {
  batch(() => {
    for (const c of b.categories ?? []) upsert("expense_category", c);
    for (const c of b.customers ?? []) upsert("customer", c);
    for (const o of b.orders ?? []) upsert("order", o);
    for (const l of b.lines ?? []) upsert("order_line", l);
    for (const p of b.payments ?? []) upsert("payment", p);
    for (const e of b.expenses ?? []) upsert("expense", e);
    for (const d of b.designs ?? []) upsert("design", d);
  });
}
