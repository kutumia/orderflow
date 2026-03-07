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
        brand: {
          50: "#EBF5FB",
          100: "#D6EAF8",
          200: "#AED6F1",
          300: "#85C1E9",
          400: "#5DADE2",
          500: "#2E86C1",
          600: "#2471A3",
          700: "#1B4F72",
          800: "#154360",
          900: "#0E2F44",
        },
        success: {
          50: "#E8F8F5",
          500: "#27AE60",
          600: "#229954",
        },
        warning: {
          50: "#FEF9E7",
          500: "#E67E22",
        },
        danger: {
          50: "#FDEDEC",
          500: "#C0392B",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
