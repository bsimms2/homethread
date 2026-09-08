/**
 * All money is stored as integer cents ("minor units"). Never floats.
 * All dates are ISO "YYYY-MM-DD" strings in the owner's local time.
 */
export type Cents = number;
export type IsoDate = string;

export type OrderStatus =
  | "quote" // priced, customer hasn't said yes
  | "confirmed" // customer said yes; in the queue
  | "in_progress" // hooped / stitching
  | "done" // stitched, waiting on pickup or delivery
  | "delivered" // in the customer's hands
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "quote",
  "confirmed",
  "in_progress",
  "done",
  "delivered",
  "cancelled",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  quote: "Quote",
  confirmed: "To make",
  in_progress: "Stitching",
  done: "Ready for pickup",
  delivered: "Finished",
  cancelled: "Cancelled",
};

/** The three stages she thinks in. Quotes and cancelled orders are outside them. */
export type Stage = "to_make" | "ready" | "finished";
export const STAGE_OF: Partial<Record<OrderStatus, Stage>> = {
  confirmed: "to_make",
  in_progress: "to_make",
  done: "ready",
  delivered: "finished",
};
export const STAGE_LABEL: Record<Stage, string> = {
  to_make: "To make",
  ready: "Made, not picked up",
  finished: "Finished",
};

/** Statuses that count toward revenue. A quote or cancelled order never does. */
export const REVENUE_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "confirmed",
  "in_progress",
  "done",
  "delivered",
]);

export type PaymentMethod = "cash" | "venmo" | "other";

export interface Customer {
  id: string;
  name: string;
  /** Where the order came in: "text", "facebook", etc. Free text. */
  contact: string;
  notes: string;
  createdAt: string;
}

export interface OrderLine {
  id: string;
  orderId: string;
  description: string;
  qty: number;
  /** Price charged per unit. */
  unitPrice: Cents;
  /** What it cost her per unit: blank garment + thread + stabilizer + time. */
  unitCost: Cents;
  /** Stitch count of the design on this line, when known. Drives quoting. */
  stitches: number | null;
  position: number;
  /** Blank consumed by this line (one per qty). Null when none or unknown. */
  blankId: string | null;
  /** Price-list product this line was picked from, for reporting. */
  productId: string | null;
}

/** One sellable option on her price list: "Wreath sash · Two sides embroidered". */
export interface Product {
  id: string;
  name: string;
  option: string;
  /** Finished pieces in this option (a 2-towel set = 2). */
  qty: number;
  /** Price for the whole option. */
  price: Cents;
  notes: string;
  position: number;
  createdAt: string;
}

/** A purchase of blanks: sashes, towels, bags. Remaining is derived from order lines. */
export interface Blank {
  id: string;
  type: string;
  style: string;
  vendor: string;
  purchasedOn: IsoDate | null;
  qty: number;
  totalCost: Cents;
  unitCost: Cents;
  /** Manual correction to remaining (negative = lost/damaged/gifted outside an order). */
  adjust: number;
  notes: string;
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string | null;
  customerName: string;
  status: OrderStatus;
  /** Date the order was taken. Revenue is recognised on this date. */
  orderedOn: IsoDate;
  dueOn: IsoDate | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: Cents;
  method: PaymentMethod;
  receivedOn: IsoDate;
  note: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  position: number;
}

export interface Expense {
  id: string;
  vendor: string;
  spentOn: IsoDate;
  /** Total paid including tax. */
  amount: Cents;
  /** Sales tax portion, if the receipt broke it out. */
  tax: Cents;
  categoryId: string | null;
  note: string;
  /** App-local path to the receipt image, if captured from a photo. */
  receiptImagePath: string | null;
  /** What the extractor read, verbatim, for audit. JSON string or null. */
  extractionJson: string | null;
  /**
   * Startup / one-time investment (machine, first supply run, design files)
   * rather than a cost of running the business month to month. Kept out of
   * monthly net and tracked as "startup left to recover" instead.
   */
  isStartup: boolean;
  createdAt: string;
}
