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
        backgroundLight: "#fcf8ff",
        backgroundDark: "#0c0e15",
        panelDark: "rgb(var(--surface-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        elevated: "rgb(var(--elevated-rgb) / <alpha-value>)",
        primary: "rgb(var(--primary-rgb) / <alpha-value>)",
        primarySoft: "rgb(var(--primary-rgb) / <alpha-value>)",
        navigation: "rgb(var(--navigation-rgb) / <alpha-value>)",
        textPrimary: "rgb(var(--foreground-rgb) / <alpha-value>)",
        textSecondary: "rgb(var(--secondary-rgb) / <alpha-value>)",
        success: "rgb(var(--success-rgb) / <alpha-value>)",
        pending: "rgb(var(--warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--critical-rgb) / <alpha-value>)",
        info: "rgb(var(--primary-rgb) / <alpha-value>)",
      },
      borderRadius: {
        control: "0.5rem",
        card: "0.75rem",
        feature: "0.875rem",
      },
      fontFamily: {
        sans: ["var(--font-lexend)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 5px rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;

