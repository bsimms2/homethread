import { describe, expect, it } from "vitest";
import {
  monthPeriod,
  monthlySeries,
  orderTotals,
  periodLabel,
  profitAndLoss,
  shortDate,
  yearPeriod,
} from "../src/reports";
import type { Expense, Order, OrderLine, Payment } from "../src/types";

const order = (id: string, status: Order["status"], orderedOn: string): Order => ({
  id,
  customerId: null,
  customerName: "C",
  status,
  orderedOn,
  dueOn: null,
  notes: "",
  createdAt: "",
  updatedAt: "",
});
const line = (orderId: string, qty: number, unitPrice: number, unitCost: number): OrderLine => ({
  id: `${orderId}-l`,
  orderId,
  description: "hat",
  qty,
  unitPrice,
  unitCost,
  stitches: null,
  position: 0,
});
const pay = (orderId: string, amount: number, receivedOn: string): Payment => ({
  id: `${orderId}-p${amount}`,
  orderId,
  amount,
  method: "cash",
  receivedOn,
  note: "",
});
const exp = (amount: number, spentOn: string, categoryId: string | null = "sup"): Expense => ({
  id: `e${amount}${spentOn}`,
  vendor: "Hobby Lobby",
  spentOn,
  amount,
  tax: 0,
  categoryId,
  note: "",
  receiptImagePath: null,
  extractionJson: null,
  createdAt: "",
});

describe("orderTotals", () => {
  it("sums lines and payments for one order only", () => {
    const o = order("a", "done", "2026-09-01");
    const t = orderTotals(
      o,
      [line("a", 3, 2500, 1000), line("b", 1, 9999, 1)],
      [pay("a", 5000, "2026-09-02"), pay("b", 1, "2026-09-02")],
    );
    expect(t).toEqual({ orderId: "a", revenue: 7500, cost: 3000, margin: 4500, paid: 5000, balance: 2500 });
  });
});

describe("profitAndLoss", () => {
  const orders = [
    order("a", "delivered", "2026-09-03"),
    order("q", "quote", "2026-09-04"), // never revenue
    order("x", "cancelled", "2026-09-05"), // never revenue
    order("aug", "done", "2026-08-30"), // previous month
  ];
  const lines = [
    line("a", 2, 3000, 1200),
    line("q", 1, 5000, 0),
    line("x", 1, 5000, 0),
    line("aug", 1, 4000, 1000),
  ];
  const payments = [pay("a", 2000, "2026-09-03"), pay("aug", 4000, "2026-09-01")];
  const expenses = [exp(1500, "2026-09-10"), exp(500, "2026-09-11", "thr"), exp(999, "2026-08-31")];

  it("recognises revenue on order date, only for real orders", () => {
    const p = profitAndLoss(monthPeriod(2026, 9), orders, lines, payments, expenses);
    expect(p.orderCount).toBe(1);
    expect(p.revenue).toBe(6000);
    expect(p.cogs).toBe(2400);
    expect(p.grossMargin).toBe(3600);
    expect(p.expenses).toBe(2000);
    expect(p.netIncome).toBe(4000);
    expect(p.outstanding).toBe(4000);
  });
  it("cash received follows payment date, not order date", () => {
    const p = profitAndLoss(monthPeriod(2026, 9), orders, lines, payments, expenses);
    expect(p.cashReceived).toBe(6000); // 2000 on 'a' + 4000 on the August order paid in Sept
  });
  it("groups expenses by category, largest first", () => {
    const p = profitAndLoss(monthPeriod(2026, 9), orders, lines, payments, expenses);
    expect(p.byCategory).toEqual([
      { categoryId: "sup", amount: 1500 },
      { categoryId: "thr", amount: 500 },
    ]);
  });
  it("year period covers both months", () => {
    const p = profitAndLoss(yearPeriod(2026), orders, lines, payments, expenses);
    expect(p.revenue).toBe(10000);
    expect(p.expenses).toBe(2999);
  });
  it("monthly series has twelve rows", () => {
    const s = monthlySeries(2026, orders, lines, payments, expenses);
    expect(s).toHaveLength(12);
    expect(s[7]?.revenue).toBe(4000);
    expect(s[8]?.net).toBe(4000);
    expect(s[0]?.label).toBe("Jan");
  });
});

describe("periods", () => {
  it("month period handles February and December", () => {
    expect(monthPeriod(2028, 2)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthPeriod(2026, 12)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
  it("labels", () => {
    expect(periodLabel(monthPeriod(2026, 9))).toBe("Sep 2026");
    expect(periodLabel(yearPeriod(2026))).toBe("2026");
    expect(shortDate("2026-09-05")).toBe("Sep 5");
  });
});
