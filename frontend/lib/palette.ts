// Muted, print-like topic colours for the paper background. Indexed by cluster id so a
// topic keeps its colour everywhere it appears (atlas, legend, preview).
const TOPIC_COLORS = [
  "#C4401C", // vermilion
  "#2F5D8A", // slate blue
  "#5E7D3A", // moss
  "#8A5A2B", // umber
  "#6B4E8A", // plum
  "#2E7A78", // teal
  "#A3476B", // rose madder
  "#B08415", // ochre
  "#44546A", // graphite blue
  "#7A6A4F", // khaki
  "#3F7F5F", // viridian
  "#8C3B3B", // oxblood
];

export function topicColor(id: number): string {
  return TOPIC_COLORS[((id % TOPIC_COLORS.length) + TOPIC_COLORS.length) % TOPIC_COLORS.length];
}
