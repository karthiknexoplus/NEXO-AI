/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/webview/**/*.{tsx,ts,html}"],
  theme: {
    extend: {
      colors: {
        nexo: {
          bg: "var(--nexo-bg)",
          elevated: "var(--nexo-bg-elevated)",
          border: "var(--nexo-border)",
          fg: "var(--nexo-fg)",
          muted: "var(--nexo-fg-muted)",
          input: "var(--nexo-input-bg)",
          accent: "var(--nexo-accent)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        composer: "1rem",
      },
      boxShadow: {
        composer: "0 8px 32px rgba(0,0,0,0.2)",
      },
    },
  },
  plugins: [],
};
