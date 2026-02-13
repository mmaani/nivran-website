import type { CSSProperties, InputHTMLAttributes } from "react";

export default function Input({ style, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const base: CSSProperties = {
    width: "100%",
    borderRadius: 14,
    border: "1px solid var(--line)",
    background: "var(--surface)",
    color: "var(--ink)",
    padding: "12px 14px",
    fontSize: 14,
  };

  return <input style={{ ...base, ...style }} {...props} />;
}
