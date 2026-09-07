import type { Cents } from "./types";

/** "$1,234.56" / "-$3.00" / "$0.00". Never signed-plus; this is a ledger, not a bet. */
export function fmtMoney(cents: Cents, opts: { cents?: boolean } = {}): string {
  const showCents = opts.cents ?? true;
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.trunc(abs / 100);
  const rem = abs % 100;
  const withCommas = dollars.toLocaleString("en-US");
  const body = showCents ? `${withCommas}.${String(rem).padStart(2, "0")}` : withCommas;
  return `${neg ? "-" : ""}$${body}`;
}

/**
 * Parse what a person types into a money box: "12", "12.5", "$1,204.99", " 3 ".
 * Returns null when it isn't a number. Half-cents round to nearest.
 */
export function parseMoney(input: string): Cents | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  if (!/^-?\d*(\.\d*)?$/.test(cleaned)) return null;
  // String arithmetic so "1.005" rounds to 101, not to 100 via 100.49999.
  const neg = cleaned.startsWith("-");
  const [whole = "", frac = ""] = (neg ? cleaned.slice(1) : cleaned).split(".");
  const dollars = whole === "" ? 0 : Number(whole);
  const fracDigits = (frac + "000").slice(0, 3);
  let cents = Number(fracDigits.slice(0, 2));
  if (Number(fracDigits[2]) >= 5) cents += 1;
  const total = dollars * 100 + cents;
  return neg ? -total : total;
}

/** Cents back to the string a money box should show while editing ("12.50"). */
export function centsToInput(cents: Cents): string {
  if (cents === 0) return "";
  return (cents / 100).toFixed(2);
}

/** Dollars-as-number (from an API or a receipt) to cents. Guards NaN. */
export function toCents(dollars: number | null | undefined): Cents {
  if (dollars === null || dollars === undefined || !Number.isFinite(dollars)) return 0;
  return Math.round(dollars * 100);
}

/** Percent with one decimal, or an en dash when the denominator is zero. */
export function fmtPct(numerator: number, denominator: number): string {
  if (denominator === 0) return "–";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}
