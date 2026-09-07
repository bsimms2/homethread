import { toCents } from "./money";
import type { Cents, IsoDate } from "./types";

/**
 * What we ask Claude to read off a receipt photo. Kept deliberately small:
 * she confirms on-screen, so a wrong guess costs one tap, not a bad ledger.
 */
export interface ReceiptExtraction {
  vendor: string;
  /** YYYY-MM-DD or null if unreadable. */
  date: string | null;
  total: number;
  tax: number | null;
  items: { description: string; amount: number }[];
  /** One of the category names we passed in, or null. */
  category: string | null;
  /** Anything worth telling the human: "total is faded", "two receipts in frame". */
  warning: string | null;
}

/** JSON Schema for the Messages API `output_config.format`. */
export const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    date: { type: ["string", "null"] },
    total: { type: "number" },
    tax: { type: ["number", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
        },
        required: ["description", "amount"],
        additionalProperties: false,
      },
    },
    category: { type: ["string", "null"] },
    warning: { type: ["string", "null"] },
  },
  required: ["vendor", "date", "total", "tax", "items", "category", "warning"],
  additionalProperties: false,
} as const;

export function receiptSystemPrompt(categoryNames: string[], today: IsoDate): string {
  return [
    "You read receipt photos for a one-person embroidery business and return the fields in the schema.",
    "Amounts are US dollars as plain numbers. `total` is what was actually paid, after tax and discounts.",
    "`date` is the purchase date as YYYY-MM-DD; if the year is missing assume the most recent occurrence on or before today (" +
      today +
      "). If no date is legible, return null.",
    "`items` lists the line items you can read, with their extended amounts; keep it short, skip subtotals.",
    "`category` must be exactly one of: " +
      categoryNames.map((c) => JSON.stringify(c)).join(", ") +
      ". Choose by what the purchase is for; blanks, thread, stabilizer and hoops are supplies. Return null if none fit.",
    "`warning` is a short note only if something is unreadable, cut off, or looks like more than one receipt. Otherwise null.",
    'Do not invent a vendor; if the store name is not visible use a short description like "unknown craft store".',
  ].join("\n");
}

export interface ReceiptDraft {
  vendor: string;
  spentOn: IsoDate;
  amount: Cents;
  tax: Cents;
  categoryName: string | null;
  items: { description: string; amount: Cents }[];
  warning: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate the model's JSON and convert to cents. Throws on a shape we can't
 * use; the caller shows the error and lets her type it in by hand.
 */
export function parseReceiptExtraction(raw: unknown, fallbackDate: IsoDate): ReceiptDraft {
  if (typeof raw !== "object" || raw === null) throw new Error("Extraction was not an object");
  const r = raw as Record<string, unknown>;
  const vendor = typeof r["vendor"] === "string" ? r["vendor"].trim() : "";
  const total = typeof r["total"] === "number" ? r["total"] : NaN;
  if (!Number.isFinite(total)) throw new Error("No total on the receipt");
  const date = typeof r["date"] === "string" && ISO.test(r["date"]) ? r["date"] : fallbackDate;
  const tax = typeof r["tax"] === "number" ? r["tax"] : 0;
  const rawItems = Array.isArray(r["items"]) ? (r["items"] as unknown[]) : [];
  const items: ReceiptDraft["items"] = [];
  for (const i of rawItems) {
    if (typeof i !== "object" || i === null) continue;
    const it = i as Record<string, unknown>;
    if (typeof it["description"] !== "string" || typeof it["amount"] !== "number") continue;
    items.push({ description: it["description"].trim(), amount: toCents(it["amount"]) });
  }
  return {
    vendor: vendor || "Unknown vendor",
    spentOn: date,
    amount: toCents(total),
    tax: toCents(tax),
    categoryName: typeof r["category"] === "string" ? r["category"] : null,
    items,
    warning:
      typeof r["warning"] === "string" && r["warning"].trim() ? r["warning"].trim() : null,
  };
}

/** Default category list for a fresh install. She can rename or add. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  "Blanks & garments",
  "Thread & stabilizer",
  "Machine & equipment",
  "Software & designs",
  "Shipping & packaging",
  "Marketing",
  "Mileage & travel",
  "Other",
];
