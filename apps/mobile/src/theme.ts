/** Warm, light palette. Thread-on-linen, not a spreadsheet. */
export const colors = {
  bg: "#faf7f2",
  card: "#ffffff",
  cardAlt: "#f3eee6",
  border: "#e4dcd0",
  text: "#2b2622",
  textDim: "#7d736a",
  accent: "#b5533c", // rust thread
  accentSoft: "#f6e3dd",
  good: "#3d8c5c",
  goodSoft: "#e2f1e7",
  bad: "#b23a3a",
  badSoft: "#f6e0e0",
  warn: "#b7791f",
  warnSoft: "#f8ecd6",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16 };

export const font = {
  title: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  h2: { fontSize: 17, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  dim: { fontSize: 14, color: colors.textDim },
  small: { fontSize: 12, color: colors.textDim },
  money: { fontSize: 16, fontWeight: "600" as const, color: colors.text, fontVariant: ["tabular-nums" as const] },
  big: { fontSize: 28, fontWeight: "700" as const, color: colors.text, fontVariant: ["tabular-nums" as const] },
};
