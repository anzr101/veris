import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paper, ink, one vermilion accent. Status colours are reserved for verification.
        paper: { DEFAULT: "#F4F3EF", deep: "#ECEAE4" },
        surface: "#FDFCFA",
        ink: { DEFAULT: "#141413", soft: "#3B3A37" },
        muted: "#76746D",
        faint: "#A9A69E",
        line: "rgba(20,20,19,0.09)",
        accent: { DEFAULT: "#C4401C", soft: "rgba(196,64,28,0.08)" },
        ok: "#2F7A4D",
        warn: "#A66A12",
        bad: "#B3261E",
      },
      fontFamily: {
        serif: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        label: "0.08em",
      },
      boxShadow: {
        float: "0 1px 2px rgba(20,20,19,0.04), 0 12px 32px -12px rgba(20,20,19,0.14)",
        field: "0 1px 1px rgba(20,20,19,0.03), 0 8px 24px -16px rgba(20,20,19,0.18)",
      },
      maxWidth: {
        page: "1180px",
        read: "680px",
      },
    },
  },
  plugins: [],
};

export default config;
