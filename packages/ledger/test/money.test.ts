import { describe, expect, it } from "vitest";
import { centsToInput, fmtMoney, fmtPct, parseMoney, toCents } from "../src/money";

describe("fmtMoney", () => {
  it("formats cents with commas and two decimals", () => {
    expect(fmtMoney(0)).toBe("$0.00");
    expect(fmtMoney(5)).toBe("$0.05");
    expect(fmtMoney(123456)).toBe("$1,234.56");
    expect(fmtMoney(-300)).toBe("-$3.00");
  });
  it("can drop cents", () => {
    expect(fmtMoney(123456, { cents: false })).toBe("$1,234");
  });
});

describe("parseMoney", () => {
  it("reads what people type", () => {
    expect(parseMoney("12")).toBe(1200);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("$1,204.99")).toBe(120499);
    expect(parseMoney(" 3 ")).toBe(300);
    expect(parseMoney(".5")).toBe(50);
  });
  it("rejects junk", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.2.3")).toBeNull();
    expect(parseMoney("-")).toBeNull();
  });
  it("rounds half cents", () => {
    expect(parseMoney("1.005")).toBe(101);
  });
  it("round-trips through the input box", () => {
    expect(centsToInput(1250)).toBe("12.50");
    expect(centsToInput(0)).toBe("");
    expect(parseMoney(centsToInput(99999))).toBe(99999);
  });
});

describe("toCents / fmtPct", () => {
  it("guards bad numbers", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(null)).toBe(0);
    expect(toCents(NaN)).toBe(0);
  });
  it("percent with a zero denominator", () => {
    expect(fmtPct(1, 0)).toBe("–");
    expect(fmtPct(25, 100)).toBe("25.0%");
  });
});
