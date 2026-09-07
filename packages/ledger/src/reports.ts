import type { Cents, Expense, IsoDate, Order, OrderLine, Payment } from "./types";
import { REVENUE_STATUSES } from "./types";

export interface Period {
  /** Inclusive. */
  from: IsoDate;
  /** Inclusive. */
  to: IsoDate;
}

export interface OrderTotals {
  orderId: string;
  revenue: Cents;
  cost: Cents;
  margin: Cents;
  paid: Cents;
  balance: Cents;
}

export interface PnL {
  period: Period;
  orderCount: number;
  revenue: Cents;
  /** Cost of goods sold: sum of line unitCost x qty on revenue orders. */
  cogs: Cents;
  grossMargin: Cents;
  /** Everything captured as an expense in the period (receipts). */
  expenses: Cents;
  /**
   * revenue - expenses. COGS is *not* also subtracted: her supply receipts
   * are the real cash cost; unitCost is an estimate used for per-order margin.
   */
  netIncome: Cents;
  cashReceived: Cents;
  /** Money still owed on revenue orders in the period, as of now. */
  outstanding: Cents;
  byCategory: { categoryId: string | null; amount: Cents }[];
}

export function inPeriod(date: IsoDate, p: Period): boolean {
  return date >= p.from && date <= p.to;
}

export function lineRevenue(l: OrderLine): Cents {
  return l.unitPrice * l.qty;
}
export function lineCost(l: OrderLine): Cents {
  return l.unitCost * l.qty;
}

export function orderTotals(order: Order, lines: OrderLine[], payments: Payment[]): OrderTotals {
  const mine = lines.filter((l) => l.orderId === order.id);
  const revenue = mine.reduce((s, l) => s + lineRevenue(l), 0);
  const cost = mine.reduce((s, l) => s + lineCost(l), 0);
  const paid = payments
    .filter((p) => p.orderId === order.id)
    .reduce((s, p) => s + p.amount, 0);
  return { orderId: order.id, revenue, cost, margin: revenue - cost, paid, balance: revenue - paid };
}

export function profitAndLoss(
  period: Period,
  orders: Order[],
  lines: OrderLine[],
  payments: Payment[],
  expenses: Expense[],
): PnL {
  const revenueOrders = orders.filter(
    (o) => REVENUE_STATUSES.has(o.status) && inPeriod(o.orderedOn, period),
  );
  let revenue = 0;
  let cogs = 0;
  let outstanding = 0;
  for (const o of revenueOrders) {
    const t = orderTotals(o, lines, payments);
    revenue += t.revenue;
    cogs += t.cost;
    outstanding += Math.max(0, t.balance);
  }
  const periodExpenses = expenses.filter((e) => inPeriod(e.spentOn, period));
  const expenseTotal = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const cashReceived = payments
    .filter((p) => inPeriod(p.receivedOn, period))
    .reduce((s, p) => s + p.amount, 0);

  const cat = new Map<string | null, Cents>();
  for (const e of periodExpenses) cat.set(e.categoryId, (cat.get(e.categoryId) ?? 0) + e.amount);
  const byCategory = [...cat.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    period,
    orderCount: revenueOrders.length,
    revenue,
    cogs,
    grossMargin: revenue - cogs,
    expenses: expenseTotal,
    netIncome: revenue - expenseTotal,
    cashReceived,
    outstanding,
    byCategory,
  };
}

// ---------------------------------------------------------------------------
// Period helpers

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function today(): IsoDate {
  return isoDate(new Date());
}

export function monthPeriod(year: number, month1to12: number): Period {
  const last = new Date(year, month1to12, 0).getDate();
  return {
    from: `${year}-${pad2(month1to12)}-01`,
    to: `${year}-${pad2(month1to12)}-${pad2(last)}`,
  };
}

export function yearPeriod(year: number): Period {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function periodLabel(p: Period): string {
  const [fy, fm] = p.from.split("-");
  const [ty, tm] = p.to.split("-");
  if (fy === ty && fm === tm) return `${MONTHS[Number(fm) - 1]} ${fy}`;
  if (fy === ty && p.from.endsWith("-01-01") && p.to.endsWith("-12-31")) return String(fy);
  return `${p.from} to ${p.to}`;
}

/** "Sep 5" style label for a list row. */
export function shortDate(iso: IsoDate): string {
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

/** Monthly revenue/expense series for a chart or a table. Oldest first. */
export function monthlySeries(
  year: number,
  orders: Order[],
  lines: OrderLine[],
  payments: Payment[],
  expenses: Expense[],
): { month: number; label: string; revenue: Cents; expenses: Cents; net: Cents }[] {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const p = profitAndLoss(monthPeriod(year, m), orders, lines, payments, expenses);
    out.push({
      month: m,
      label: MONTHS[m - 1] ?? String(m),
      revenue: p.revenue,
      expenses: p.expenses,
      net: p.netIncome,
    });
  }
  return out;
}
