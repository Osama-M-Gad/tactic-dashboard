import type { CSSProperties, ReactNode } from "react";

export type Variant = "success" | "danger" | "neutral";

export default function BadgePill({
  children,
  variant = "neutral",
  style,
}: {
  children: ReactNode;
  variant?: Variant;
  style?: CSSProperties;
}) {
  const tone =
    variant === "success"
      ? { bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.35)", text: "#16a34a" }
      : variant === "danger"
      ? { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.35)", text: "#ef4444" }
      : { bg: "var(--chip-bg)", border: "var(--divider)", text: "var(--muted)" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.2,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        minWidth: 64,
        justifyContent: "center",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
