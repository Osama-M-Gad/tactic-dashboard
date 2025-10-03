"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { logout } from "@/utils/session";

type Props = {
  isArabic: boolean;
  onToggleLang: () => void;
  showLogout?: boolean;
  className?: string;
};

export default function AppHeader({
  isArabic,
  onToggleLang,
  showLogout = true,
  className,
}: Props) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dir = isArabic ? "rtl" : "ltr";
      localStorage.setItem("lang", isArabic ? "ar" : "en");
    }
  }, [isArabic]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const preferred: "dark" | "light" =
      saved ??
      (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(preferred);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div
      role="banner"
      className={["app-header", className].filter(Boolean).join(" ")}
      style={{
        width: "100%",
        backgroundColor: "var(--header-bg)",
        color: "var(--text)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 20px",
        borderBottom: "1px solid var(--divider)",
        minHeight: 72,
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!logoFailed ? (
          <Image
  src="/logo.png"
  alt="Tactic Portal"
  width={200}        // كان 140
  height={60}        // أو 70 حسب شكل اللوجو
  priority
  style={{ height: 56, width: "auto" }}   // كان 40؛ تقدر تخليها 60 لو حابب
  onError={() => setLogoFailed(true)}
/>
        ) : (
          <strong style={{ fontSize: 18 }}>Tactic Portal</strong>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link
          href="https://www.tai.com.sa"
          target="_blank"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-foreground)",
            padding: "8px 12px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: "0.9rem",
          }}
        >
          {isArabic ? "الموقع التعريفي" : "Company Site"}
        </Link>

        {showLogout && (
          <button
            onClick={logout}
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-foreground)",
              padding: "8px 12px",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            {isArabic ? "تسجيل الخروج" : "Logout"}
          </button>
        )}

        <button
          onClick={onToggleLang}
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-foreground)",
            padding: "8px 12px",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          {isArabic ? "EN" : "AR"}
        </button>

        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
          style={{
            backgroundColor: "var(--chip-bg)",
            color: "var(--text)",
            padding: "8px 12px",
            border: "1px solid var(--divider)",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          {theme === "dark"
            ? isArabic
              ? "فاتح"
              : "Light"
            : isArabic
            ? "داكن"
            : "Dark"}
        </button>
      </div>
    </div>
  );
}
