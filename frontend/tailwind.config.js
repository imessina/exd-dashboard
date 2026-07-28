/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Azul corporativo brillante (acentos, botones, estados activos)
        brand: {
          50: "#eaf6fd",
          100: "#d0edfb",
          200: "#a1dbf7",
          300: "#6cc4ef",
          400: "#3db3ea",
          500: "#1c9fe4", // azul principal — acento corporativo
          600: "#127cba",
          700: "#0f6690",
          800: "#0d4f70",
        },
        // Azul marino oscuro (sidebar, headers, textos fuertes) — look corporativo
        navy: {
          50: "#eef1f6",
          100: "#d7dde8",
          400: "#33456b",
          500: "#1c2c4c",
          600: "#15213a",
          700: "#101a2e",
          800: "#0c1424",
          900: "#080f1c", // navy más oscuro — fondo sidebar
        },
        // Fondo de la app — gris/blanco neutro, look profesional
        surface: { DEFAULT: "#f4f6f9", subtle: "#f9fafc" },
      },
      fontFamily: {
        sans: [
          '"Inter"',
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 6px 20px rgba(37,99,235,0.06)",
        "card-hover":
          "0 4px 16px rgba(0,0,0,0.07), 0 16px 40px rgba(37,99,235,0.11)",
        btn: "0 2px 10px rgba(37,99,235,0.30)",
        "btn-hover": "0 6px 20px rgba(37,99,235,0.40)",
        panel: "-2px 0 40px rgba(0,0,0,0.10)",
        nav: "0 2px 8px rgba(37,99,235,0.22)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
