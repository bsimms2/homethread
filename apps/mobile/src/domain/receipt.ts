import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { parseReceiptExtraction, today, type ReceiptDraft } from "@embroidery/ledger";
import { supabase } from "../db/supabase";
import { newId } from "./ids";

// ---------------------------------------------------------------------------
// 1. Get a picture. On the web this is a file input; on a phone browser that
//    opens the camera directly.

export interface CapturedImage {
  /** Displayable URI (data: on web, file: on native). */
  uri: string;
  /** JPEG, downscaled, base64 without the data: prefix. */
  base64: string;
}

export async function captureReceipt(source: "camera" | "library"): Promise<CapturedImage | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera permission was not granted.");
  }
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (result.canceled || !result.assets[0]) return null;

  // 1600px wide is plenty for a receipt and keeps the request small and cheap.
  const out = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 1600 } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!out.base64) throw new Error("Could not read the photo.");
  return { uri: out.uri, base64: out.base64 };
}

// ---------------------------------------------------------------------------
// 2. Keep the original (tax evidence) in the private `receipts` bucket.

const BUCKET = "receipts";

export async function persistReceiptImage(image: CapturedImage): Promise<string> {
  const path = `${newId()}.jpg`;
  const bytes = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Couldn't save the photo: ${error.message}`);
  return path;
}

/** Short-lived URL for showing a stored receipt. Null when there isn't one. */
export async function receiptImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// 3. Read it with Claude, via the `read-receipt` edge function that holds the
//    API key. See supabase/functions/read-receipt.

export interface ExtractionResult {
  draft: ReceiptDraft;
  /** Verbatim model JSON, stored on the expense for audit. */
  rawJson: string;
}

export async function extractReceipt(image: CapturedImage, categoryNames: string[]): Promise<ExtractionResult> {
  const { data, error } = await supabase.functions.invoke<{ raw?: string; error?: string }>("read-receipt", {
    body: { image: image.base64, mediaType: "image/jpeg", categories: categoryNames, today: today() },
  });
  if (error) {
    // The function returns a JSON {error} body on 4xx/5xx; surface it if we can.
    const ctx = (error as { context?: Response }).context;
    let msg = error.message;
    try {
      const body = ctx ? ((await ctx.json()) as { error?: string }) : null;
      if (body?.error) msg = body.error;
    } catch {
      // keep the generic message
    }
    throw new Error(msg);
  }
  if (!data?.raw) throw new Error(data?.error ?? "Empty response from the receipt reader.");
  const raw: unknown = JSON.parse(data.raw);
  return { draft: parseReceiptExtraction(raw, today()), rawJson: data.raw };
}
