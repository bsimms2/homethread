import React from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { Customer, Expense, ExpenseCategory, Order, OrderLine, Payment } from "@embroidery/ledger";
import { allCategories, allCustomers, allExpenses, allLines, allOrders, allPayments } from "../db/repo";
import { refreshIfStale, subscribe } from "../db/store";

export interface Ledger {
  orders: Order[];
  lines: OrderLine[];
  payments: Payment[];
  expenses: Expense[];
  customers: Customer[];
  categories: ExpenseCategory[];
}

function load(): Ledger {
  return {
    orders: allOrders(),
    lines: allLines(),
    payments: allPayments(),
    expenses: allExpenses(),
    customers: allCustomers(),
    categories: allCategories(),
  };
}

/**
 * Snapshot of the in-memory ledger. Re-reads when the screen gains focus,
 * when any write lands, and when a background refresh pulls the other
 * phone's changes.
 */
export function useLedger(): Ledger & { reload: () => void } {
  const [data, setData] = React.useState<Ledger>(load);
  const reload = React.useCallback(() => setData(load()), []);
  useFocusEffect(
    React.useCallback(() => {
      reload();
      void refreshIfStale();
    }, [reload]),
  );
  React.useEffect(() => subscribe(reload), [reload]);
  return { ...data, reload };
}

export function categoryName(categories: ExpenseCategory[], id: string | null): string {
  return categories.find((c) => c.id === id)?.name ?? "Uncategorized";
}
