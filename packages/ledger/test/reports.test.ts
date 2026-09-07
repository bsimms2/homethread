import { describe, expect, it } from "vitest";
import {
  blankStock,
  monthPeriod,
  monthlySeries,
  orderTotals,
  periodLabel,
  profitAndLoss,
  shortDate,
  startupPayback,
  yearPeriod,
} from "../src/reports";
import type { Blank, Expense, Order, OrderLine, Payment } from "../src/types";

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
const line = (orderId: string, qty: number, unitPrice: number, unitCost: number, blankId: string | null = null): OrderLine => ({
  id: `${orderId}-l${blankId ?? ""}`,
  orderId,
  description: "hat",
  qty,
  unitPrice,
  unitCost,
  stitches: null,
  position: 0,
  blankId,
  productId: null,
});
const pay = (orderId: string, amount: number, receivedOn: string): Payment => ({
  id: `${orderId}-p${amount}`,
  orderId,
  amount,
  method: "cash",
  receivedOn,
  note: "",
});
const exp = (amount: number, spentOn: string, categoryId: string | null = "sup", isStartup = false): Expense => ({
  id: `e${amount}${spentOn}${isStartup}`,
  vendor: "Hobby Lobby",
  spentOn,
  amount,
  tax: 0,
  categoryId,
  note: "",
  receiptImagePath: null,
  extractionJson: null,
  isStartup,
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
  const expenses = [
    exp(1500, "2026-09-10"),
    exp(500, "2026-09-11", "thr"),
    exp(999, "2026-08-31"),
    exp(70000, "2026-09-01", "mach", true), // the machine: startup, not operating
  ];

  it("recognises revenue on order date, only for real orders", () => {
    const p = profitAndLoss(monthPeriod(2026, 9), orders, lines, payments, expenses);
    expect(p.orderCount).toBe(1);
    expect(p.revenue).toBe(6000);
    expect(p.cogs).toBe(2400);
    expect(p.grossMargin).toBe(3600);
    expect(p.expenses).toBe(2000);
    expect(p.startupExpenses).toBe(70000);
    expect(p.netIncome).toBe(4000);
    expect(p.outstanding).toBe(4000);
  });
  it("cash received follows payment date, not order date", () => {
    const p = profitAndLoss(monthPeriod(2026, 9), orders, lines, payments, expenses);
    expect(p.cashReceived).toBe(6000);
  });
  it("groups operating expenses by category, largest first", () => {
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
  it("startup payback comes out of all-time net", () => {
    const pb = startupPayback(orders, lines, payments, expenses);
    expect(pb.startupTotal).toBe(70000);
    expect(pb.recovered).toBe(10000 - 2999);
    expect(pb.remaining).toBe(70000 - 7001);
  });
  it("payback never exceeds the startup total or goes negative", () => {
    const pb = startupPayback(orders, lines, payments, [exp(100, "2026-01-01", null, true)]);
    expect(pb).toEqual({ startupTotal: 100, recovered: 100, remaining: 0 });
    const none = startupPayback([], [], [], [exp(500, "2026-01-01", null, true), exp(900, "2026-01-02")]);
    expect(none).toEqual({ startupTotal: 500, recovered: 0, remaining: 500 });
  });
});

describe("blankStock", () => {
  const blank: Blank = {
    id: "sash-white", type: "Wreath Sash", style: "White", vendor: "Amazon", purchasedOn: "2026-08-23",
    qty: 12, totalCost: 1899, unitCost: 158, adjust: -1, notes: "", createdAt: "",
  };
  it("counts units on live orders only, plus manual adjustment", () => {
    const orders = [order("a", "delivered", "2026-09-01"), order("q", "quote", "2026-09-02"), order("x", "cancelled", "2026-09-03")];
    const lines = [line("a", 3, 2500, 158, "sash-white"), line("q", 5, 2500, 158, "sash-white"), line("x", 2, 2500, 158, "sash-white"), line("a", 1, 2500, 0, "other")];
    const s = blankStock(blank, orders, lines);
    expect(s.used).toBe(3);
    expect(s.remaining).toBe(12 - 3 - 1);
    expect(s.valueRemaining).toBe(8 * 158);
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
