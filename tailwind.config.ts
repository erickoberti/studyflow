import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        backgroundLight: "#f6f5f8",
        backgroundDark: "#151022",
        panelDark: "#1b1530",
        primary: "#895af6",
        primarySoft: "#ae8aff",
      },
      borderRadius: {
        card: "1rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 20px 40px rgba(137, 90, 246, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
