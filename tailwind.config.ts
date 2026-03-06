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
        base: "#f4f7fb",
        ink: "#10253f",
        brand: "#0f6ad9",
        brandSoft: "#dbeafe",
        accent: "#f59e0b",
      },
      borderRadius: {
        card: "1rem",
      },
      fontFamily: {
        sans: ["var(--font-work-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 12px 30px rgba(15, 106, 217, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;

