import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx,mdx}",
    "./src/features/**/*.{ts,tsx,mdx}",
    "./src/layout/**/*.{ts,tsx,mdx}",
    "./src/lib/**/*.{ts,tsx,mdx}",
    "./src/shared/**/*.{ts,tsx,mdx}",
    "./src/utils/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        mono: ["var(--font-mono)", ...fontFamily.mono],
      },
      colors: {
        background: "#f8f8f9",
        foreground: "#0f172a",
        sidebar: "#0b0f1a",
        "sidebar-muted": "#111827",
        accent: {
          DEFAULT: "#ef4444",
          dark: "#b91c1c",
          light: "#fecdd3",
        },
        muted: "#e5e7eb",
        border: "#e2e8f0",
        card: "#ffffff",
      },
      boxShadow: {
        card: "0 10px 40px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
