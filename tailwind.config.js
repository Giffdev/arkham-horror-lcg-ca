import fs from "fs";

/** @type {import('tailwindcss').Config} */

let theme = {};
try {
  const themePath = "./theme.json";

  if (fs.existsSync(themePath)) {
    theme = JSON.parse(fs.readFileSync(themePath, "utf-8"));
  }
} catch (err) {
  console.error('failed to parse custom styles', err)
}
const defaultTheme = {
  container: {
    center: true,
    padding: "2rem",
  },
  extend: {
    screens: {
      coarse: { raw: "(pointer: coarse)" },
      fine: { raw: "(pointer: fine)" },
      pwa: { raw: "(display-mode: standalone)" },
    },
    borderRadius: {
      sm: "var(--radius-sm)",
      md: "var(--radius-md)",
      lg: "var(--radius-lg)",
      xl: "var(--radius-xl)",
      "2xl": "var(--radius-2xl)",
      full: "var(--radius-full)",
    },
  },
  darkMode: ["selector", '[data-appearance="dark"]'],
}

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { ...defaultTheme, ...theme },
};