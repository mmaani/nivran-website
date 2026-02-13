import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        gold: "var(--gold)",
      },
      transitionDuration: {
        180: "180ms",
      },
      transitionTimingFunction: {
        calm: "ease",
      },
    },
  },
  plugins: [],
};

export default config;
