"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  label?: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  rtl?: boolean;
};

export default function MultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder = "Select...",
  rtl = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter(o => o.toLowerCase().includes(s)) : options;
  }, [q, options]);

  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter(x => x !== v));
    else onChange([...values, v]);
  };

  const clearAll = () => onChange([]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {label && (
        <div style={{ marginBottom: 6, color: "#bbb", fontWeight: 600, textAlign: rtl ? "right" : "left" }}>
          {label}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          minHeight: 40,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #333",
          background: "#1a1a1a",
          color: "#fff",
          textAlign: "start",
        }}
      >
        {values.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {values.map(v => (
              <span key={v} style={{
                padding: "4px 8px",
                borderRadius: 14,
                background: "#303030",
                border: "1px solid #444",
                fontSize: 12,
                fontWeight: 700
              }}>{v}</span>
            ))}
          </div>
        ) : (
          <span style={{ color: "#888" }}>{placeholder}</span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            marginTop: 6,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            background: "#0f0f0f",
            border: "1px solid #2c2c2c",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,.4)",
            padding: 8,
          }}
          dir={rtl ? "rtl" : "ltr"}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={rtl ? "ابحث..." : "Search..."}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#1a1a1a",
                color: "#fff",
                outline: "none",
              }}
            />
            {values.length > 0 && (
              <button type="button" onClick={clearAll}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #444", background: "#222", color: "#ddd" }}>
                {rtl ? "مسح" : "Clear"}
              </button>
            )}
          </div>

          <div style={{ maxHeight: 220, overflowY: "auto", borderTop: "1px solid #222" }}>
            {filtered.length ? filtered.map(v => {
              const checked = values.includes(v);
              return (
                <label key={v} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 6px",
                  borderBottom: "1px solid #151515",
                  cursor: "pointer",
                  userSelect: "none",
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(v)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ color: checked ? "#fff" : "#ccc", fontWeight: checked ? 700 : 500 }}>{v}</span>
                </label>
              );
            }) : (
              <div style={{ color: "#888", padding: 10 }}>{rtl ? "لا نتائج" : "No results"}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
