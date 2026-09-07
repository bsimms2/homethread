import { describe, expect, it } from "vitest";
import { detectCsvKind, importCsv, parseCsv, parseDate, parseStatus } from "../src/import";

describe("parseCsv", () => {
  it("handles quotes, embedded commas, CRLF and a BOM", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","she said ""hi"""\r\n\r\n1,2\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x, y", 'she said "hi"'],
      ["1", "2"],
    ]);
  });
});

describe("parseDate / parseStatus", () => {
  it("reads the formats a spreadsheet produces", () => {
    expect(parseDate("2026-09-05")).toBe("2026-09-05");
    expect(parseDate("9/5/2026")).toBe("2026-09-05");
    expect(parseDate("9/5/26")).toBe("2026-09-05");
    expect(parseDate("2026/9/5")).toBe("2026-09-05");
    expect(parseDate("09-05-2026")).toBe("2026-09-05");
    expect(parseDate("2/30/2026")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("Sept 5")).toBeNull();
  });
  it("maps status words", () => {
    expect(parseStatus("Delivered")).toBe("delivered");
    expect(parseStatus("in progress")).toBe("in_progress");
    expect(parseStatus("Ready")).toBe("done");
    expect(parseStatus("???")).toBeNull();
  });
});

describe("detectCsvKind", () => {
  it("tells the three files apart", () => {
    expect(detectCsvKind(["Name", "Stitches", "Price"])).toBe("designs");
    expect(detectCsvKind(["Date", "Vendor", "Amount", "Category"])).toBe("expenses");
    expect(detectCsvKind(["Customer", "Date", "Item", "Qty", "Price"])).toBe("orders");
    expect(detectCsvKind(["foo", "bar"])).toBeNull();
  });
});

describe("importCsv designs", () => {
  it("parses and keys by name", () => {
    const r = importCsv("Design,Stitch Count,Usual Price,Blank Cost,Notes\nMallard,8200,$25,6.50,green thread\n,100,1,1,\n");
    expect(r.kind).toBe("designs");
    expect(r.designs).toEqual([
      { key: "design|mallard", name: "Mallard", stitches: 8200, defaultPrice: 2500, defaultCost: 650, notes: "green thread" },
    ]);
    expect(r.errors).toEqual([{ row: 3, message: "missing name" }]);
  });
});

describe("importCsv expenses", () => {
  it("parses dates and money, flags bad rows", () => {
    const r = importCsv("date,vendor,total,tax,category,what\n9/1/26,Hobby Lobby,\"$1,043.27\",2.84,Thread & stabilizer,thread\nbad,X,5,,,\n9/2/26,Amazon,,,,\n");
    expect(r.kind).toBe("expenses");
    expect(r.expenses).toHaveLength(1);
    expect(r.expenses[0]).toMatchObject({ vendor: "Hobby Lobby", spentOn: "2026-09-01", amount: 104327, tax: 284, categoryName: "Thread & stabilizer", note: "thread" });
    expect(r.errors.map((e) => e.row)).toEqual([3, 4]);
  });
});

describe("importCsv orders", () => {
  const csv = [
    "Order,Customer,Date,Due,Status,Item,Qty,Price,Cost,Stitches,Paid,Method,Paid On,Notes",
    "1,Jane Doe,8/1/26,8/10/26,delivered,Mallard hat,2,25,6.5,8200,50,Venmo,8/9/26,navy",
    "1,Jane Doe,8/1/26,,,Monogram towel,1,18,4,,,,,",
    ",Bob,8/3/26,,paid,Buck cap,1,30,7,,,cash,,",
    ",Ann,8/4/26,,,Wood duck,1,28,7,,,,,",
    ",Ann,8/4/26,,,,0,0,,,,,,",
  ].join("\n");

  it("groups lines into orders and reads one payment per order", () => {
    const r = importCsv(csv);
    expect(r.kind).toBe("orders");
    expect(r.orders).toHaveLength(3);
    const jane = r.orders[0]!;
    expect(jane.key).toBe("order|ref|1");
    expect(jane.lines).toHaveLength(2);
    expect(jane.lines[0]).toEqual({ description: "Mallard hat", qty: 2, unitPrice: 2500, unitCost: 650, stitches: 8200 });
    expect(jane.payment).toEqual({ amount: 5000, method: "venmo", receivedOn: "2026-08-09" });
    expect(jane.dueOn).toBe("2026-08-10");
    expect(jane.status).toBe("delivered");
    expect(jane.notes).toBe("navy");
  });
  it("'paid' status means paid in full on the order date", () => {
    const bob = importCsv(csv).orders[1]!;
    expect(bob.key).toBe("order|bob|2026-08-03");
    expect(bob.status).toBe("delivered");
    expect(bob.payment).toEqual({ amount: 3000, method: "cash", receivedOn: "2026-08-03" });
  });
  it("blank status defaults to delivered, blank paid means unpaid, empty rows error", () => {
    const r = importCsv(csv);
    const ann = r.orders[2]!;
    expect(ann.status).toBe("delivered");
    expect(ann.payment).toBeNull();
    expect(r.errors).toEqual([{ row: 6, message: "row has no item and no price" }]);
  });
});
