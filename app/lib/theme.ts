// Shared color palette and chart config — import from here, don't redefine

export const GOLD   = "#C9A84C";
export const DARK   = "#080810";
export const PANEL  = "#0D0D1A";
export const BORDER = "#1A1A2E";
export const TEXT   = "#E8E8F0";
export const MUTED  = "#555570";
export const GREEN  = "#2ECC71";
export const RED    = "#E74C3C";
export const BLUE   = "#3498DB";

export const CHART_TOOLTIP = {
  contentStyle: { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 10, fontFamily: "monospace" },
  labelStyle:   { color: MUTED },
  itemStyle:    { color: TEXT },
};
export const CHART_TICK   = { fontSize: 9, fill: MUTED, fontFamily: "monospace" };
export const CHART_LEGEND = { wrapperStyle: { fontSize: 10, fontFamily: "monospace", color: MUTED } };

export const PALETTE_COLORS = [GOLD, BLUE, GREEN, "#9B59B6", "#E74C3C", "#1ABC9C", "#F39C12"];
