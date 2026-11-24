/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        collabrix: {
          background: "#0b1020",
          surface: "#111827",
          elevated: "#172033",
          border: "#273449",
          text: "#f8fafc",
          muted: "#94a3b8",
          accent: "#7c3aed",
          "accent-hover": "#8b5cf6",
          danger: "#ef4444",
          success: "#22c55e",
        },
      },
      boxShadow: {
        panel: "0 18px 50px rgba(2, 6, 23, 0.35)",
      },
    },
  },
  plugins: [],
};
