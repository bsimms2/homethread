import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING, quoteOrderLine } from "../src/quote";

describe("quoteOrderLine", () => {
  it("rounds stitches up to the next thousand", () => {
    const q = quoteOrderLine({ stitches: 8200, qty: 1, garmentCost: 0, needsDigitizing: false });
    expect(q.unitStitchCharge).toBe(900);
  });
  it("applies the per-piece minimum", () => {
    const q = quoteOrderLine({ stitches: 2500, qty: 1, garmentCost: 0, needsDigitizing: false });
    expect(q.unitStitchCharge).toBe(DEFAULT_PRICING.minStitchCharge);
  });
  it("no stitches means no stitch charge", () => {
    const q = quoteOrderLine({ stitches: 0, qty: 1, garmentCost: 1000, needsDigitizing: false });
    expect(q.unitStitchCharge).toBe(0);
    expect(q.unitGarmentPrice).toBe(1500);
  });
  it("totals qty and adds setup once", () => {
    const q = quoteOrderLine(
      { stitches: 12000, qty: 10, garmentCost: 800, needsDigitizing: true },
      { ratePer1k: 100, garmentMarkup: 1.5, minStitchCharge: 800, setupFee: 2500 },
    );
    expect(q.unitPrice).toBe(1200 + 1200);
    expect(q.total).toBe(2400 * 10 + 2500);
  });
});
