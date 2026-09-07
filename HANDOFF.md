# HomeThread (embroidery ledger) — session handoff

> **2026-09-06 evening: pivoted from native app to WEBSITE.** Same code, built with
> `expo export --platform web`. Storage moved from on-phone SQLite to Supabase
> (project `punorbgwckjyexbbkpvq`), sign-in is a magic link gated by an
> `allowed_users` table, the Claude call lives in the `read-receipt` edge function,
> receipt photos go to a private `receipts` bucket. Read `supabase/SETUP.md`.
> Sections below that mention SQLite / Expo Go / EAS describe the old shape.
>
> Architecture: `src/db/store.ts` holds the whole ledger in memory (loaded at sign-in,
> refreshed on tab focus); `repo.ts` keeps its synchronous API over those arrays and
> queues every write to Supabase in order with retry. So the screens didn't change.
> `components/dialog.ts` shims `Alert.alert`, which React Native Web silently no-ops.
>
> Her real business (from `Homethread.xlsx` on her flash drive, copy in the session
> scratchpad): product price list (wreath sash $20–25, towels, mahjong bags), blank
> inventory with cost per blank, startup-cost payback, purchased Etsy designs + 7
> monogram fonts. **Next build:** price list, blanks inventory, startup payback on
> Home, and a `tools/homethread_import.py` that converts her workbook straight to the
> app's CSVs. Stitch-count quoting is not how she prices; keep it but de-emphasise.

**Read this first.** Written for a fresh session with no memory of the previous ones.

## 1. What this is

A phone-first bookkeeping app for a one-person embroidery business (Brendan's partner;
Bernette b70, orders arrive by text or Facebook message, paid in cash or Venmo). Built
2026-09-06. Working name in `app.json` is "Stitch Ledger" — a placeholder, rename freely.

Scope agreed with Brendan: **phases 1 and 2 only.** No tax features, no storefront, no
online payments. The business has to grow before those matter.

- **Phase 1 (built):** snap a receipt → Claude reads vendor/date/total/tax/category →
  she confirms → expense saved with the photo. Manual orders with line items. Home
  dashboard. Monthly/yearly P&L: revenue, cost of items, gross margin, expenses, net.
- **Phase 2 (built, untested on device):** order pipeline (quote → confirmed → stitching →
  ready → delivered), customers with quick-add, payments against orders (Venmo/cash),
  per-order margin, stitch-count quote button with editable pricing rules, JSON backup.

## 2. Where everything lives

| What | Where |
|---|---|
| Code | `C:\Dev\EmbroideryApp` (outside OneDrive, like GolfApp) |
| Pure logic + tests | `packages/ledger` — money, reports, receipt schema/prompt, quote formula |
| App | `apps/mobile` — Expo SDK 54, React Navigation (tabs + stacks), expo-sqlite |
| Embroidery design pipeline | `C:\Dev\Embroidery` (separate; stitch counts come from there) |

Layout mirrors `C:\Dev\GolfApp` on purpose: same pnpm workspace, hoisted linker, Metro
config, Expo SDK pin, and the same traps (see GolfApp `HANDOFF.md` §3).

## 3. Running it

```
cd C:\Dev\EmbroideryApp
pnpm install
pnpm --filter @embroidery/ledger test      # 24 tests
pnpm -r typecheck
cd apps\mobile && npx expo start
```

Scan the QR with Expo Go on an iPhone. Expo SDK is pinned to **57** (upgraded from 54 on
2026-09-06 because her freshly-installed Expo Go required it). Expo Go only runs ONE SDK
version: Brendan's own phone still has the SDK 54 Expo Go that GolfApp needs, so updating
it to test this app would break GolfApp-in-Expo-Go until GolfApp is upgraded too.
Use `npx expo start --tunnel` when her phone isn't on the PC's Wi-Fi. `@expo/ngrok` is a
devDependency of `apps/mobile` on purpose: Expo's "install it globally?" prompt installs it
but then can't resolve it from the project and errors with "Install @expo/ngrok and try again".

Then in the app: Settings → paste an Anthropic API key → Expenses → Snap receipt.

## 4. Design decisions worth knowing

- **All money is integer cents**, dates are `YYYY-MM-DD` strings. `parseMoney` uses string
  arithmetic because `1.005 * 100` rounds wrong in floats.
- **Revenue is recognised on order date** for orders in any status except `quote` and
  `cancelled`. Cash received is tracked separately by payment date. Both show on Reports.
- **Net income = revenue − receipts.** Line `unitCost` is her estimate and feeds per-order
  margin only; it is deliberately *not* subtracted again (her supply receipts already are).
- **SQLite on the phone is the source of truth.** No server. Settings has a JSON backup
  export via the share sheet. Receipt photos are copied into `documentDirectory/receipts/`
  and stored by *relative* path because iOS changes the container path between installs.
- **Receipt reading is a raw `fetch`** to `POST /v1/messages`, not `@anthropic-ai/sdk` —
  the SDK README says React Native is unsupported. Model `claude-opus-5`, effort `low`,
  structured output pinned to `RECEIPT_SCHEMA`, server-side `fallbacks: "default"`.
  Cost is roughly a cent or two per receipt.
- **The API key sits in the iOS keychain** (expo-secure-store) on her phone. Fine for one
  trusted user. If the app ever has a second user, put a tiny proxy in front and only
  `src/domain/receipt.ts` changes.
- **Whole-ledger reload on screen focus** (`useLedger`). Dataset is one small business;
  there's no cache to get stale.
- **Date inputs are plain text** (`YYYY-MM-DD`, validated on save). A native picker is a
  nicety for later.

- **Design library** (`design` table, Orders → Designs): name, stitch count, usual price and
  blank cost, notes. "Design…" on an order line fills description/stitches/cost/price. The
  .exp/.svg files themselves stay in `C:\Dev\Embroidery`; the app stores only what quoting
  needs. `analyze_exp.py` there can produce stitch counts for bulk entry later.
- **Leaving an edit screen uses `leaveTo()`** (`src/domain/navUtil.ts`), never bare
  `goBack()`. First device test: Home → Snap receipt opened ExpenseEdit as the tab's only
  route, goBack bounced to Home, the filled form stayed alive, and she saved it twice.
  Home now also passes `initial: false` so the list sits underneath.

- **Bulk import** (Settings → Import): CSV for designs / expenses / orders (see
  `templates/IMPORT.md`, column aliases in `packages/ledger/src/import.ts`) or a JSON backup
  restore. CSV rows get ids from a SHA-256 of their identifying columns (`imp-…`), so
  re-importing updates instead of duplicating. `tools/designs_csv.py <folder>` scans
  `.exp`/`.pes` files and writes a designs CSV with stitch counts (skips reference/fonts).

## 5. Status / what's next

- [x] Ledger package: 24 tests green, typecheck clean.
- [x] `expo export --platform ios` bundles cleanly (all imports resolve under Metro).
- [ ] **Not yet run on a device.** Next step is `expo start` + Expo Go on Brendan's iPhone,
      then a real receipt through the camera flow. Things most likely to need a tweak on
      first run: `expo-image-manipulator` (legacy `manipulateAsync` import), camera
      permission plugin config in `app.json`, KeyboardAvoidingView offsets.
- [ ] Getting it onto *her* phone: EAS build (`eas.json` is copied from GolfApp) or
      TestFlight. Expo Go works for testing but she shouldn't live in it.
- [ ] Nice-to-haves once it's in use: native date picker, photo viewer for receipts,
      edit a payment, mileage log, order-ready text via the share sheet.
