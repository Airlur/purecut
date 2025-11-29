/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-dark": "#0A0F1E",
        "brand-gray": "#F5F6FA",
        "brand-blue": "#3B82F6",
        "brand-slate": "#6B7280",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 30px 60px -24px rgba(15, 23, 42, 0.25)",
        ring: "0 0 0 1px rgba(59, 130, 246, 0.2)",
      },
      backgroundImage: {
        "dot-grid":
          "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.08) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
}
