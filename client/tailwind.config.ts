import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: {
            50: "#FFF0F5",
            100: "#FFE0EB",
            200: "#FFBDD4",
            300: "#FF8FB5",
            400: "#F59AB9",
            500: "#E87DA3",
            600: "#D4608A",
            700: "#B84672",
            800: "#942F5A",
            900: "#701C44",
          },
          sage: {
            50: "#F5F6F0",
            100: "#EAECE1",
            200: "#DDE0D1",
            300: "#C7CAAB",
            400: "#B0B490",
            500: "#989C77",
            600: "#7F835F",
            700: "#666A4B",
            800: "#4D5038",
            900: "#353727",
          },
        },
        surface: {
          0: "#FFFFFF",
          50: "#FAFAFA",
          100: "#F5F5F5",
          200: "#EEEEEE",
          300: "#E0E0E0",
          400: "#BDBDBD",
          500: "#9E9E9E",
          600: "#757575",
          700: "#616161",
          800: "#424242",
          900: "#212121",
          950: "#0A0A0A",
        },
      },
      fontFamily: {
        sans: ["Outfit", "Cairo", "system-ui", "sans-serif"],
        display: ["Outfit", "Cairo", "sans-serif"],
        arabic: ["Cairo", "Outfit", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(245, 154, 185, 0.15)",
        "glow-lg": "0 0 40px rgba(245, 154, 185, 0.2)",
        card: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 24px rgba(0,0,0,0.08)",
        float: "0 8px 30px rgba(0,0,0,0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "slide-up-sheet": "slideUpSheet 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-glow": "pulseGlow 2.5s infinite ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        slideUpSheet: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1", transform: "scale(1)", boxShadow: "0 0 15px rgba(245, 154, 185, 0.4)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)", boxShadow: "0 0 25px rgba(245, 154, 185, 0.7)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
