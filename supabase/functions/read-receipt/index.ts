// Supabase Edge Function: read a receipt photo with Claude.
//
// The Anthropic key lives here as a secret, never in the browser. The caller
// must be a signed-in, allow-listed user (checked via their JWT).
//
// Deploy:  supabase functions deploy read-receipt
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5";

const RECEIPT_SCHEMA = {
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
        properties: { description: { type: "string" }, amount: { type: "number" } },
        required: ["description", "amount"],
        additionalProperties: false,
      },
    },
    category: { type: ["string", "null"] },
    warning: { type: ["string", "null"] },
  },
  required: ["vendor", "date", "total", "tax", "items", "category", "warning"],
  additionalProperties: false,
};

function systemPrompt(categories: string[], today: string): string {
  return [
    "You read receipt photos for a one-person embroidery business and return the fields in the schema.",
    "Amounts are US dollars as plain numbers. `total` is what was actually paid, after tax and discounts.",
    "`date` is the purchase date as YYYY-MM-DD; if the year is missing assume the most recent occurrence on or before today (" +
      today +
      "). If no date is legible, return null.",
    "`items` lists the line items you can read, with their extended amounts; keep it short, skip subtotals.",
    "`category` must be exactly one of: " +
      categories.map((c) => JSON.stringify(c)).join(", ") +
      ". Choose by what the purchase is for; blanks, thread, stabilizer and hoops are supplies. Return null if none fit.",
    "`warning` is a short note only if something is unreadable, cut off, or looks like more than one receipt. Otherwise null.",
    'Do not invent a vendor; if the store name is not visible use a short description like "unknown craft store".',
  ].join("\n");
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

  // 1. Who is asking? Must be signed in and on the allowlist.
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Not signed in." }, 401);
  const { data: allowed } = await supabase.rpc("is_allowed");
  if (!allowed) return json({ error: "This account isn't allowed to use the ledger." }, 403);

  // 2. Read the image with Claude.
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY secret is not set on the function." }, 500);

  const { image, mediaType, categories, today } = (await req.json()) as {
    image: string;
    mediaType?: string;
    categories: string[];
    today: string;
  };
  if (!image) return json({ error: "No image." }, 400);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt(categories ?? [], today),
      output_config: { effort: "low", format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
      fallbacks: "default",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType ?? "image/jpeg", data: image } },
            { type: "text", text: "Read this receipt." },
          ],
        },
      ],
    }),
  });
  const body = (await res.json()) as {
    error?: { message: string };
    stop_reason?: string;
    content?: { type: string; text?: string }[];
  };
  if (!res.ok) return json({ error: body.error?.message ?? `Anthropic HTTP ${res.status}` }, 502);
  if (body.stop_reason === "refusal") return json({ error: "The model declined to read this image." }, 422);
  const text = body.content?.find((b) => b.type === "text")?.text;
  if (!text) return json({ error: "Empty response from the model." }, 502);
  return json({ raw: text });
});
