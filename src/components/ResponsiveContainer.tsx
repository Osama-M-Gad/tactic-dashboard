"use client";
import React from "react";

/** حاوية عالمية تجعل كل المحتوى متجاوب للموبايل والكمبيوتر */
export default function ResponsiveContainer({
  children,
  center = false,
  maxWidth = 1200,
  padding = 16,
  style,
}: {
  children: React.ReactNode;
  center?: boolean;
  maxWidth?: number;
  padding?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "calc(100vh - var(--header-h))",
        display: "flex",
        justifyContent: center ? "center" : "flex-start",
        alignItems: center ? "center" : "flex-start",
        padding: `${padding}px`,
        boxSizing: "border-box",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: `${maxWidth}px`,
          margin: "0 auto",
          flex: "1 1 auto",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
