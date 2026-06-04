import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        mono: ['"VT323"', "monospace"],
      },
      colors: {
        arcade: {
          bg: "#0d0221",
          surface: "#190b34",
          surface2: "#240b3a",
          line: "#3a1769",
          text: "#e8e8ff",
          muted: "#7a7a99",
          primary: "#39ff14",
          cyan: "#01cdfe",
          pink: "#ff71ce",
          magenta: "#b967ff",
          yellow: "#fffb96",
          gold: "#fff200",
          red: "#ff3864",
          grid: "#190b34",
        },
      },
      boxShadow: {
        neon: "0 0 6px var(--tw-shadow-color), 0 0 12px var(--tw-shadow-color)",
        "neon-lg": "0 0 12px var(--tw-shadow-color), 0 0 24px var(--tw-shadow-color), 0 0 36px var(--tw-shadow-color)",
        bevel: "inset 0 0 0 2px #000, inset 0 0 0 4px var(--tw-shadow-color)",
        "bevel-down": "inset 0 4px 0 0 rgba(0,0,0,0.4), inset 0 -4px 0 0 rgba(255,255,255,0.1)",
        "bevel-up": "inset 0 4px 0 0 rgba(255,255,255,0.15), inset 0 -4px 0 0 rgba(0,0,0,0.4)",
      },
      animation: {
        blink: "blink 1.1s steps(2, start) infinite",
        "glow-pulse": "glow-pulse 2.4s ease-in-out infinite",
        glitch: "glitch 2.6s steps(8, end) infinite",
        flicker: "flicker 6s steps(60, end) infinite",
        scan: "scan 8s linear infinite",
        "pop-in": "pop-in 220ms steps(6, end)",
      },
      keyframes: {
        blink: { "50%": { opacity: "0" } },
        "glow-pulse": {
          "0%, 100%": { filter: "drop-shadow(0 0 2px currentColor)" },
          "50%": { filter: "drop-shadow(0 0 6px currentColor) drop-shadow(0 0 12px currentColor)" },
        },
        glitch: {
          "0%, 90%, 100%": { transform: "translate(0,0)" },
          "92%": { transform: "translate(-2px, 1px)" },
          "94%": { transform: "translate(2px, -1px)" },
          "96%": { transform: "translate(-1px, 2px)" },
          "98%": { transform: "translate(1px, -2px)" },
        },
        flicker: {
          "0%, 19%, 22%, 62%, 64%, 100%": { opacity: "1" },
          "20%, 21%, 63%": { opacity: "0.85" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
