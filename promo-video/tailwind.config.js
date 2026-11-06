// Disalin dari landing-page/tailwind.config.ts supaya kelas Tailwind di video
// menghasilkan tampilan yang sama persis dengan Mira (Semi Pixel-Art theme).
const PX_SOFT = "#CFE2EE";
const PX_ACCENT = "#0369A1";

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
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
        code: {
          bg: "#131b26",
          text: "#cdd6f4",
          accent: "#7DD3FC",
        },
      },
      borderWidth: {
        DEFAULT: "2px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        pixel: ["var(--font-pixel)", "var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        sm: `2px 2px 0 0 ${PX_SOFT}`,
        DEFAULT: `3px 3px 0 0 ${PX_SOFT}`,
        md: `4px 4px 0 0 ${PX_SOFT}`,
        lg: `6px 6px 0 0 ${PX_SOFT}`,
        xl: `8px 8px 0 0 ${PX_SOFT}`,
        "2xl": `10px 10px 0 0 ${PX_SOFT}`,
        float: `6px 6px 0 0 ${PX_ACCENT}`,
      },
    },
  },
  plugins: [],
};
