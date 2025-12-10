/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#c9b974",
        logo: "#cfb755",
        base: "#0d0f11",
        "base-secondary": "#24272e",
        danger: "#e76a5e",
        success: "#a5e75e",
        basic: "#9099ac",
        tertiary: "#454545",
        "tertiary-light": "#b7bdc2",
        content: "#ecedee",
        "content-2": "#f9fbfe",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "SF Pro",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "Fira Sans",
          "Droid Sans",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: [
          "source-code-pro",
          "Menlo",
          "Monaco",
          "Consolas",
          "Courier New",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
