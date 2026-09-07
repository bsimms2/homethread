import type { Cents } from "./types";

/**
 * Industry-standard embroidery pricing: a per-thousand-stitch rate on top of
 * the garment, plus a one-time setup (digitizing) fee, with a floor per piece.
 * All cents. The defaults live in app settings; this is just the formula.
 */
export interface PricingRules {
  /** Charged per 1,000 stitches, rounded UP to the next thousand. */
  ratePer1k: Cents;
  /** Multiplier on the garment cost, e.g. 1.5 = 50% markup on the blank. */
  garmentMarkup: number;
  /** Per-piece minimum for the stitching portion (not counting the garment). */
  minStitchCharge: Cents;
  /** One-time per order when a new design has to be digitized. */
  setupFee: Cents;
}

export const DEFAULT_PRICING: PricingRules = {
  ratePer1k: 100, // $1.00 per 1k stitches
  garmentMarkup: 1.5,
  minStitchCharge: 800, // $8 minimum stitching per piece
  setupFee: 0,
};

export interface QuoteInput {
  stitches: number;
  qty: number;
  garmentCost: Cents;
  needsDigitizing: boolean;
}

export interface Quote {
  unitPrice: Cents;
  unitStitchCharge: Cents;
  unitGarmentPrice: Cents;
  setupFee: Cents;
  total: Cents;
}

export function quoteOrderLine(input: QuoteInput, rules: PricingRules = DEFAULT_PRICING): Quote {
  const thousands = Math.max(0, Math.ceil(input.stitches / 1000));
  const raw = thousands * rules.ratePer1k;
  const unitStitchCharge = input.stitches > 0 ? Math.max(raw, rules.minStitchCharge) : 0;
  const unitGarmentPrice = Math.round(input.garmentCost * rules.garmentMarkup);
  const unitPrice = unitStitchCharge + unitGarmentPrice;
  const setupFee = input.needsDigitizing ? rules.setupFee : 0;
  const qty = Math.max(0, Math.floor(input.qty));
  return {
    unitPrice,
    unitStitchCharge,
    unitGarmentPrice,
    setupFee,
    total: unitPrice * qty + setupFee,
  };
}
