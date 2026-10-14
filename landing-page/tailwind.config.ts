import type { Config } from "tailwindcss";

// Fluid Currents Light v2 (Muara AI DESIGNV2)
// Palette: light estuary canvas, deep riverbed ink, river current blue accent.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F7FAFC",
        "surface-alt": "#F0F7FB",
        surface: "rgba(255, 255, 255, 0.60)",
        "surface-solid": "#ffffff",
        stroke: "#D9E5ED",
        foreground: "#072033",
        secondary: "#3B5A70",
        accent: {
          DEFAULT: "#0369A1",
          hover: "#075985",
          dark: "#072033",
          muted: "rgba(3, 105, 161, 0.12)",
          glow: "rgba(3, 105, 161, 0.25)",
        },
        success: "#0F766E",
        warning: "#9A3412",
        danger: "#BE123C",
        glass: {
          DEFAULT: "rgba(255, 255, 255, 0.60)",
          hover: "rgba(255, 255, 255, 0.80)",
          border: "rgba(255, 255, 255, 0.85)",
          strong: "rgba(255, 255, 255, 0.92)",
        },
        code: {
          bg: "#131b26",
          text: "#cdd6f4",
          // Light accent readable on the dark code surface (8.9:1).
          accent: "#7DD3FC",
        },
      },
      fontFamily: {
        sans: ["var(--font-gordita)", "var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-gordita)", "var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        anton: ["var(--font-anton)", "Impact", "sans-serif"],
      },
      backdropBlur: {
        glass: "24px",
        "3xl": "48px",
      },
      boxShadow: {
        // Diffusion shadow (water light refraction) per DESIGNV2.
        float: "0 12px 32px -8px rgba(7, 32, 51, 0.10), 0 2px 6px -1px rgba(7, 32, 51, 0.05)",
        glass: "0 12px 32px -8px rgba(7, 32, 51, 0.05), 0 2px 6px -1px rgba(7, 32, 51, 0.03)",
        "glass-lg": "0 24px 48px rgba(7, 32, 51, 0.08)",
        "glass-xl": "0 36px 64px rgba(7, 32, 51, 0.12)",
        "glass-3d": "inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 2px 0 rgba(3, 105, 161, 0.10), 0 10px 30px -10px rgba(7, 32, 51, 0.10), 0 4px 12px -2px rgba(7, 32, 51, 0.05)",
        "glass-3d-hover": "inset 0 2px 4px 0 rgba(255, 255, 255, 1), inset 0 0 20px 0 rgba(3, 105, 161, 0.10), 0 20px 40px -10px rgba(7, 32, 51, 0.14), 0 10px 20px -5px rgba(7, 32, 51, 0.10)",
        "glass-edge": "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 1px rgba(255,255,255,0.35)",
      },
      borderRadius: {
        sm: "12px",
        card: "18px",
        "card-3d": "20px",
        lg: "26px",
        pill: "100px",
      },
      transitionTimingFunction: {
        glass: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
