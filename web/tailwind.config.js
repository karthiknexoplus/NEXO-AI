/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cursor: {
          bg: "#0a0a0b",
          sidebar: "#0f0f10",
          panel: "#111113",
          border: "rgba(255,255,255,0.08)",
          hover: "rgba(255,255,255,0.06)",
          muted: "#8b8b8f",
          fg: "#ececef",
          accent: "#6b9bd1",
          composer: "#18181b",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["SF Mono", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        composer:
          "0 0 0 1px rgba(255,255,255,0.06), 0 12px 40px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};
