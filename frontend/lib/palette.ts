// Topic colours chosen to read on both lab white and deep navy. Indexed by cluster id so
// a topic keeps its colour everywhere it appears.
const TOPIC_COLORS = [
  "#4D7DFF", // signal blue
  "#1FB5C9", // cyan
  "#12A879", // teal
  "#E09A12", // amber
  "#8D6BF2", // violet
  "#F0645A", // coral
  "#5A6FF0", // indigo
  "#27B99A", // mint
  "#D9468A", // magenta
  "#7FB82E", // lime
  "#2F95E8", // sky
  "#EC7A1E", // orange
];

export function topicColor(id: number): string {
  const n = TOPIC_COLORS.length;
  return TOPIC_COLORS[((id % n) + n) % n];
}
