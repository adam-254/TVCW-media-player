import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // TVCW Cyberpunk Palette
        cyber: {
          cyan:    "#00FFE7",
          cyanDim: "#00BFA8",
          black:   "#000000",
          dark:    "#060608",
          card:    "#0A0C10",
          border:  "#0DFFF0",
          gray:    "#1A1D24",
          muted:   "#4A5060",
          text:    "#C8D0E0",
        },
      },
      fontFamily: {
        display: ["'Orbitron'", "monospace"],
        body:    ["'Rajdhani'", "sans-serif"],
        mono:    ["'Share Tech Mono'", "monospace"],
      },
      boxShadow: {
        cyan:      "0 0 20px rgba(0,255,231,0.3)",
        cyanLg:    "0 0 40px rgba(0,255,231,0.4)",
        cyanInner: "inset 0 0 20px rgba(0,255,231,0.1)",
      },
      backgroundImage: {
        "grid-cyber":
          "linear-gradient(rgba(0,255,231,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,231,0.03) 1px, transparent 1px)",
        "glow-radial":
          "radial-gradient(ellipse at center, rgba(0,255,231,0.08) 0%, transparent 70%)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
      animation: {
        "pulse-cyan": "pulseCyan 2s ease-in-out infinite",
        "scan-line":  "scanLine 3s linear infinite",
        "flicker":    "flicker 4s linear infinite",
        "slide-up":   "slideUp 0.4s ease-out",
        "fade-in":    "fadeIn 0.5s ease-out",
      },
      keyframes: {
        pulseCyan: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(0,255,231,0.2)" },
          "50%":      { boxShadow: "0 0 30px rgba(0,255,231,0.5)" },
        },
        scanLine: {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        flicker: {
          "0%, 95%, 100%": { opacity: "1" },
          "96%":            { opacity: "0.8" },
          "97%":            { opacity: "1" },
          "98%":            { opacity: "0.6" },
          "99%":            { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
