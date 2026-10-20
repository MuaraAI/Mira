import type { Config } from "tailwindcss";

// Semi Pixel-Art theme, synced with Muara AI (muaraai.com).
// Palette: light estuary canvas, deep riverbed ink, river current blue accent.
// Shape: square corners, 2px stepped frames, hard offset drops (no blur).
const PX_SOFT = "#CFE2EE";
const PX_ACCENT = "#0369A1";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Pixel art has no rounded corners: every radius token resolves to a square edge.
    borderRadius: {
      none: "0",
      DEFAULT: "0",
      sm: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      card: "0",
      pill: "0",
      full: "0",
    },
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
        px: {
          ink: "#072033",
          line: "#163A55",
          soft: PX_SOFT,
          water: "#9CC6E0",
          "water-mid": "#5FA3CC",
          tint: "#EAF3F9",
          highlight: "#DCEBF5",
          night: "#0B2D46",
          sun: "#FCD34D",
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
      borderWidth: {
        // Hairlines become 2px pixel strokes.
        DEFAULT: "2px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        pixel: ["var(--font-pixel)", "var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        // Hard offset drops, no blur (pixel elevation).
        sm: `2px 2px 0 0 ${PX_SOFT}`,
        DEFAULT: `3px 3px 0 0 ${PX_SOFT}`,
        md: `4px 4px 0 0 ${PX_SOFT}`,
        lg: `6px 6px 0 0 ${PX_SOFT}`,
        xl: `8px 8px 0 0 ${PX_SOFT}`,
        "2xl": `10px 10px 0 0 ${PX_SOFT}`,
        float: `6px 6px 0 0 ${PX_ACCENT}`,
        glass: `4px 4px 0 0 ${PX_SOFT}`,
        "glass-lg": `6px 6px 0 0 ${PX_SOFT}`,
        "glass-xl": `8px 8px 0 0 ${PX_SOFT}`,
        "glass-3d": `5px 5px 0 0 ${PX_SOFT}`,
        "glass-3d-hover": `6px 6px 0 0 ${PX_ACCENT}`,
        "glass-edge": `inset 2px 2px 0 0 #ffffff`,
      },
      transitionTimingFunction: {
        glass: "cubic-bezier(0.16, 1, 0.3, 1)",
        px: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
