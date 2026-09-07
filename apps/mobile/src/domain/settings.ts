import { DEFAULT_PRICING, type PricingRules } from "@embroidery/ledger";
import { getSetting, setSetting } from "../db/repo";

const PRICING = "pricing_rules";

export function getPricing(): PricingRules {
  const raw = getSetting(PRICING);
  if (!raw) return DEFAULT_PRICING;
  try {
    return { ...DEFAULT_PRICING, ...(JSON.parse(raw) as Partial<PricingRules>) };
  } catch {
    return DEFAULT_PRICING;
  }
}
export function setPricing(rules: PricingRules): void {
  setSetting(PRICING, JSON.stringify(rules));
}
