import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0F172A",
        surface: "#1E293B",
        card: "#334155",
        accent: {
          DEFAULT: "#C6A75E",
          dark: "#A6884A",
          light: "#E2C786",
        },
        ink: "#F8FAFC",
        muted: "#94A3B8",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      maxWidth: {
        container: "64rem",
      },
    },
  },
  plugins: [],
};

export default config;
