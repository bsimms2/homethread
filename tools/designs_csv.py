"""
Scan a folder for embroidery files and write a designs.csv the app can import.

    python tools/designs_csv.py C:\\Dev\\Embroidery > designs.csv
    python tools/designs_csv.py C:\\Dev\\Embroidery --out designs.csv

Reads .exp (Melco, the b70's native format) with the same parser as
C:\\Dev\\Embroidery\\analyze_exp.py, and .pes via pyembroidery when installed.
One row per file: Name, Stitches, Price, Cost, Notes. Price and Cost are left
blank for her to fill in Excel; Notes holds the size and the source path so
she can tell versions apart. Skips test/pipeline folders.
"""
import argparse
import csv
import os
import sys

SKIP_DIRS = {"_pipeline_test", "out", "node_modules", ".git", "__pycache__", "reference", "fonts", "exports"}


def parse_exp(path):
    d = open(path, "rb").read()
    i = x = y = 0
    xs, ys = [], []
    while i < len(d) - 1:
        b = d[i]
        if b == 0x80:
            i += 2
            continue
        dx = d[i] - 256 if d[i] > 127 else d[i]
        dy = d[i + 1] - 256 if d[i + 1] > 127 else d[i + 1]
        x += dx
        y += dy
        xs.append(x * 0.1)
        ys.append(y * 0.1)
        i += 2
    if not xs:
        return 0, 0.0, 0.0
    return len(xs), max(xs) - min(xs), max(ys) - min(ys)


def parse_pes(path):
    try:
        import pyembroidery  # noqa: WPS433
    except ImportError:
        return None
    try:
        p = pyembroidery.read(path)
    except Exception:  # some purchased PES files trip pyembroidery's PEC reader
        return None
    if p is None:
        return None
    stitches = sum(1 for _, _, cmd in p.stitches if cmd == pyembroidery.STITCH)
    bounds = p.bounds()  # (min_x, min_y, max_x, max_y) in 0.1 mm
    w = (bounds[2] - bounds[0]) / 10.0
    h = (bounds[3] - bounds[1]) / 10.0
    return stitches, w, h


def pretty_name(path, root):
    stem = os.path.splitext(os.path.basename(path))[0]
    folder = os.path.basename(os.path.dirname(path))
    # designs/<folder>/<file>.exp  ->  prefer the folder name when the file is generic
    # a short file name inside a named design folder -> use the folder name
    generic = len(stem) <= 5 or stem.lower() in ("art", "out", "design", "final")
    name = folder if (folder not in ("designs", os.path.basename(root)) and generic) else stem
    return name.replace("_", " ").replace("-", " ").strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--out", default="-")
    ap.add_argument("--prefer", choices=["exp", "pes"], default="exp", help="when both exist for one design")
    a = ap.parse_args()

    seen = {}
    for dirpath, dirnames, filenames in os.walk(a.root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext not in (".exp", ".pes"):
                continue
            path = os.path.join(dirpath, fn)
            key = os.path.splitext(path)[0].lower()
            other = seen.get(key)
            if other and other[0] == a.prefer:
                continue
            res = parse_exp(path) if ext == ".exp" else parse_pes(path)
            if not res:
                print(f"skip (unreadable): {path}", file=sys.stderr)
                continue
            seen[key] = (ext[1:], path, res)

    rows = []
    for _, (ext, path, (stitches, w, h)) in sorted(seen.items()):
        rel = os.path.relpath(path, a.root)
        rows.append(
            {
                "Name": pretty_name(path, a.root),
                "Stitches": stitches,
                "Price": "",
                "Cost": "",
                "Notes": f"{w:.0f}x{h:.0f} mm · {rel}",
            }
        )

    out = sys.stdout if a.out == "-" else open(a.out, "w", newline="", encoding="utf-8")
    w = csv.DictWriter(out, fieldnames=["Name", "Stitches", "Price", "Cost", "Notes"], lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    if out is not sys.stdout:
        out.close()
        print(f"wrote {len(rows)} designs to {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
