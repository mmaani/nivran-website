import type { CSSProperties, HTMLAttributes } from "react";

export default function Card({ style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className="surface" style={style as CSSProperties} {...props} />;
}
