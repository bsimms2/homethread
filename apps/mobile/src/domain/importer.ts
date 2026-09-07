import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import { importCsv, type CsvImport } from "@embroidery/ledger";
import {
  categoryIdByName,
  customerByName,
  restoreBackup,
  saveCustomer,
  saveDesign,
  saveExpense,
  saveOrder,
  upsertPayment,
  type Backup,
} from "../db/repo";
import { batch } from "../db/store";

/**
 * Bulk import from a CSV (designs / expenses / orders, see templates/) or a
 * JSON backup the app exported. Ids for CSV rows are a hash of the row's
 * identifying columns, so importing the same file twice updates rather
 * than duplicates.
 */

export type ImportPreview =
  | { type: "backup"; backup: Backup; summary: string }
  | { type: "csv"; csv: CsvImport; summary: string };

export async function pickImportFile(): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "application/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const text = a.file ? await a.file.text() : await (await fetch(a.uri)).text();
  return { name: a.name, text };
}

export function previewImport(name: string, text: string): ImportPreview {
  const trimmed = text.trim();
  if (name.toLowerCase().endsWith(".json") || trimmed.startsWith("{")) {
    const backup = JSON.parse(trimmed) as Backup;
    if (!backup || typeof backup !== "object" || !("orders" in backup || "expenses" in backup))
      throw new Error("This JSON isn't a backup from this app.");
    const n = (a: unknown[] | undefined) => (a ?? []).length;
    return {
      type: "backup",
      backup,
      summary: `Backup from ${backup.exportedAt?.slice(0, 10) ?? "?"}: ${n(backup.orders)} orders, ${n(backup.expenses)} expenses, ${n(backup.customers)} customers, ${n(backup.designs)} designs. Rows in the file replace matching rows; nothing else is touched.`,
    };
  }
  const csv = importCsv(text);
  const count = csv.kind === "designs" ? csv.designs.length : csv.kind === "expenses" ? csv.expenses.length : csv.orders.length;
  const errs = csv.errors.length
    ? `\n\n${csv.errors.length} row${csv.errors.length === 1 ? "" : "s"} skipped:\n` +
      csv.errors.slice(0, 6).map((e) => `row ${e.row}: ${e.message}`).join("\n") +
      (csv.errors.length > 6 ? "\n…" : "")
    : "";
  return { type: "csv", csv, summary: `${count} ${csv.kind} ready to import.${errs}` };
}

async function idFor(key: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key);
  return `imp-${hex.slice(0, 32)}`;
}

export async function applyImport(p: ImportPreview): Promise<string> {
  if (p.type === "backup") {
    restoreBackup(p.backup);
    return "Backup restored.";
  }
  const { csv } = p;
  if (csv.kind === "designs") {
    const ids = await Promise.all(csv.designs.map((d) => idFor(d.key)));
    batch(() => {
      csv.designs.forEach((d, i) => {
        saveDesign({ id: ids[i]!, name: d.name, stitches: d.stitches, defaultPrice: d.defaultPrice, defaultCost: d.defaultCost, notes: d.notes });
      });
    });
    return `${csv.designs.length} designs imported.`;
  }
  if (csv.kind === "expenses") {
    const ids = await Promise.all(csv.expenses.map((e) => idFor(e.key)));
    batch(() => {
      csv.expenses.forEach((e, i) => {
        saveExpense({
          id: ids[i]!,
          vendor: e.vendor,
          spentOn: e.spentOn,
          amount: e.amount,
          tax: e.tax,
          categoryId: e.categoryName ? categoryIdByName(e.categoryName) : null,
          note: e.note,
          receiptImagePath: null,
          extractionJson: null,
          isStartup: false,
        });
      });
    });
    return `${csv.expenses.length} expenses imported.`;
  }
  const ids = await Promise.all(csv.orders.map((o) => idFor(o.key)));
  const payIds = await Promise.all(csv.orders.map((o) => idFor(`${o.key}|payment`)));
  batch(() => {
    csv.orders.forEach((o, i) => {
      const id = ids[i]!;
      let customerId: string | null = null;
      if (o.customerName) {
        const found = customerByName(o.customerName);
        customerId = found ? found.id : saveCustomer({ name: o.customerName, contact: "", notes: "" });
      }
      saveOrder({ id, customerId, customerName: o.customerName, status: o.status, orderedOn: o.orderedOn, dueOn: o.dueOn, notes: o.notes, lines: o.lines });
      if (o.payment) {
        upsertPayment({ id: payIds[i]!, orderId: id, amount: o.payment.amount, method: o.payment.method, receivedOn: o.payment.receivedOn, note: "imported" });
      }
    });
  });
  return `${csv.orders.length} orders imported.`;
}
