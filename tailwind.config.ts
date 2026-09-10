import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f5ff",
          100: "#dbe6ff",
          500: "#3b5bdb",
          600: "#2f47ad",
          700: "#25397f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
