import type { ButtonHTMLAttributes, CSSProperties } from "react";

type Variant = "primary" | "secondary" | "ghost";

export default function Button({
  variant = "primary",
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "10px 18px",
    fontSize: 14,
    border: "1px solid var(--ink)",
    transition: "all 180ms ease",
    cursor: "pointer",
  };

  const variants: Record<Variant, CSSProperties> = {
    primary: { background: "var(--ink)", color: "var(--bg)" },
    secondary: { background: "transparent", color: "var(--ink)" },
    ghost: { background: "transparent", color: "var(--ink)", borderColor: "transparent" },
  };

  return <button style={{ ...base, ...variants[variant], ...style }} {...props} />;
}
