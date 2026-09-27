import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lab white, deep navy instruments, one working blue. Status colours are reserved
        // for verification verdicts and system health.
        paper: { DEFAULT: "#F3F5F9", deep: "#E8ECF3" },
        surface: "#FFFFFF",
        ink: { DEFAULT: "#0A1428", soft: "#2A3852" },
        muted: "#5D6A80",
        faint: "#97A2B5",
        line: "rgba(10,20,40,0.09)",
        navy: {
          DEFAULT: "#0A1A3F",
          deep: "#061129",
          mid: "#0F2656",
          line: "rgba(150,180,255,0.14)",
        },
        blue: {
          DEFAULT: "#1F4FD8",
          bright: "#4D7DFF",
          ice: "#B7CAFF",
          soft: "rgba(31,79,216,0.07)",
        },
        ok: "#0E9F6E",
        warn: "#C27803",
        bad: "#D92D20",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        label: "0.09em",
      },
      boxShadow: {
        float: "0 1px 2px rgba(10,20,40,0.05), 0 16px 40px -16px rgba(10,20,40,0.22)",
        field: "0 1px 1px rgba(10,20,40,0.04), 0 10px 30px -18px rgba(10,20,40,0.3)",
        glow: "0 0 0 1px rgba(77,125,255,0.35), 0 12px 40px -12px rgba(31,79,216,0.55)",
      },
      maxWidth: {
        page: "1240px",
        read: "700px",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        scan: "scan 2.4s cubic-bezier(0.45,0,0.2,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
