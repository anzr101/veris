import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Atlas" — warm ink, parchment type, one restrained gold accent.
        ink: {
          DEFAULT: "#09090b",
          50: "#101013",
          100: "#17171b",
          200: "#212126",
          300: "#313139",
        },
        bone: {
          DEFAULT: "#E9E5DC",
          bright: "#F5F1E8",
        },
        mist: "#8a8a93",
        faint: "#5a5a62",
        signal: {
          DEFAULT: "#D8B26A", // muted antique gold
          soft: "#b8945230",
          dim: "#8a6d3a",
        },
        sage: "#9bb59a", // cool secondary, used only for "verified/positive"
        rose: "#cf7a7f",
        amber: "#dca24f",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        kicker: "0.24em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(216,178,106,0.22), 0 10px 50px -18px rgba(216,178,106,0.18)",
        lift: "0 30px 80px -40px rgba(0,0,0,0.85)",
        inset: "inset 0 1px 0 0 rgba(255,255,255,0.04)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        drift: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(2%,-3%) scale(1.06)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        drift: "drift 22s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
