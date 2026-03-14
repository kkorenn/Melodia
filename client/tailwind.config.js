import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        shell: "rgb(var(--color-shell) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        panelSoft: "rgb(var(--color-panel-soft) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        textSoft: "rgb(var(--color-text-soft) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        accentWarm: "rgb(var(--color-accent-warm) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "'Segoe UI'", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--color-accent) / 0.38)"
      }
    }
  },
  plugins: [tailwindcssAnimate]
};
