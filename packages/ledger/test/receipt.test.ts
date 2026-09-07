import { describe, expect, it } from "vitest";
import { parseReceiptExtraction, receiptSystemPrompt } from "../src/receipt";

describe("parseReceiptExtraction", () => {
  it("converts a good extraction to cents", () => {
    const d = parseReceiptExtraction(
      {
        vendor: " Hobby Lobby ",
        date: "2026-09-05",
        total: 43.27,
        tax: 2.84,
        items: [
          { description: "Isacord thread", amount: 6.99 },
          { description: "bad", amount: "x" },
        ],
        category: "Thread & stabilizer",
        warning: null,
      },
      "2026-09-06",
    );
    expect(d.vendor).toBe("Hobby Lobby");
    expect(d.spentOn).toBe("2026-09-05");
    expect(d.amount).toBe(4327);
    expect(d.tax).toBe(284);
    expect(d.items).toEqual([{ description: "Isacord thread", amount: 699 }]);
    expect(d.categoryName).toBe("Thread & stabilizer");
    expect(d.warning).toBeNull();
  });
  it("falls back on date and vendor, keeps warnings", () => {
    const d = parseReceiptExtraction(
      { vendor: "", date: "9/5", total: 10, tax: null, items: [], category: null, warning: " faded " },
      "2026-09-06",
    );
    expect(d.vendor).toBe("Unknown vendor");
    expect(d.spentOn).toBe("2026-09-06");
    expect(d.tax).toBe(0);
    expect(d.warning).toBe("faded");
  });
  it("throws without a total", () => {
    expect(() => parseReceiptExtraction({ vendor: "x" }, "2026-09-06")).toThrow(/total/);
    expect(() => parseReceiptExtraction(null, "2026-09-06")).toThrow();
  });
});

describe("receiptSystemPrompt", () => {
  it("lists the categories verbatim", () => {
    const p = receiptSystemPrompt(["Blanks & garments", "Other"], "2026-09-06");
    expect(p).toContain('"Blanks & garments", "Other"');
    expect(p).toContain("2026-09-06");
  });
});
