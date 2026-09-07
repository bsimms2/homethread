# Bulk import

Fill one of these in Excel, save as **CSV**, get it onto her phone (AirDrop, iCloud
Drive, email attachment → Save to Files), then in the app: **Settings → Import CSV or
backup…** and pick it. The app shows a count and any skipped rows before it writes
anything. Importing the same file again updates rows instead of duplicating them, so
fix the spreadsheet and re-import as often as you like.

Column names are flexible (case and spaces don't matter; common synonyms work) but
keep the header row. Dates can be `2026-09-05`, `9/5/2026` or `9/5/26`. Money can have
`$` and commas.

## designs.csv

| Name | Stitches | Price | Cost | Notes |
|---|---|---|---|---|
| Mallard | 8200 | 25.00 | 6.50 | green + brown thread |

Price = what she usually charges for one. Cost = what the blank usually costs her.
Both optional. Generate this file from the design folder instead of typing it:

```
cd C:\Dev\EmbroideryApp
python tools\designs_csv.py C:\Dev\Embroidery --out designs.csv
```

then fill in Price/Cost in Excel and save as CSV.

## expenses.csv

| Date | Vendor | Amount | Tax | Category | Note |
|---|---|---|---|---|---|
| 2026-08-14 | Hobby Lobby | 43.27 | 2.84 | Thread & stabilizer | Isacord thread |

Amount is the total paid including tax. Category names that don't exist yet are
created. Tax and Note optional.

## orders.csv — one row per item

| Order | Customer | Date | Due | Status | Item | Qty | Price | Cost | Stitches | Paid | Method | Paid On | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Jane Doe | 2026-08-01 | 2026-08-10 | delivered | Mallard hat | 2 | 25.00 | 6.50 | 8200 | 50.00 | Venmo | 2026-08-09 | navy |
| 1 | Jane Doe | 2026-08-01 | | | Monogram towel | 1 | 18.00 | 4.00 | | | | | |
| | Bob Smith | 2026-08-03 | | paid | Buck cap | 1 | 30.00 | 7.00 | | | cash | | |

- Rows with the same **Order** number are one order with several items. Leave Order
  blank and rows with the same Customer + Date are grouped instead.
- **Status** blank = delivered (it's history). Other values: quote, confirmed,
  stitching, ready, delivered, cancelled. `paid` = delivered and paid in full on the
  order date.
- **Paid** = amount received (one payment per order is enough for history). Method:
  Venmo / cash / other. Paid On defaults to the order date.
- Price and Cost are **per item**. Qty defaults to 1.
- Customers are created automatically.
