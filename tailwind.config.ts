import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        backgroundLight: "#f6f6f8",
        backgroundDark: "#141121",
        panelDark: "#1a1c2e",
        primary: "#3b19e6",
        primarySoft: "#7f67ff",
      },
      borderRadius: {
        card: "1rem",
      },
      fontFamily: {
        sans: ["var(--font-lexend)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 16px 34px rgba(59, 25, 230, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;

