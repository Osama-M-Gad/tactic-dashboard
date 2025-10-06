"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { logout } from "@/utils/session";
import { useLangTheme } from "@/hooks/useLangTheme";

type Props = {
  onToggleLang: () => void;
  showLogout?: boolean;
  className?: string;
};

export default function AppHeader({
  onToggleLang,
  showLogout = true,
  className,
}: Props) {
  // المصدر الوحيد للحقيقة
  const { isArabic: liveArabic } = useLangTheme();
  const langIsArabic = liveArabic; // ← دايمًا من الهوك

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [logoFailed, setLogoFailed] = useState(false);

  // ثبّت dir من localStorage أول ما الهيدر يركب (يحل مشكلة ما بعد اللوجين)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const ls = localStorage.getItem("lang"); // "ar" | "en" | null
    const shouldAr = ls === "ar" || el.getAttribute("dir") === "rtl";
    const wantDir = shouldAr ? "rtl" : "ltr";
    if (el.getAttribute("dir") !== wantDir) el.setAttribute("dir", wantDir);
  }, []);

  // ثيم — الافتراضي دايمًا DARK (نتجاهل تفضيل النظام)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const initial: "dark" | "light" = saved ?? "dark";
    setTheme(initial);
    // نثبت الـ data-theme فورًا عند mount لتفادي أي flicker
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // Toggle قوي: يحدّث dir + localStorage ثم ينادي منطقك
  const handleToggleLang = () => {
    if (typeof document !== "undefined") {
      const el = document.documentElement;
      const nowAr = el.getAttribute("dir") === "rtl" || localStorage.getItem("lang") === "ar";
      const next = nowAr ? "en" : "ar";
      el.setAttribute("dir", next === "ar" ? "rtl" : "ltr");
      localStorage.setItem("lang", next);
      window.dispatchEvent(new StorageEvent("storage", { key: "lang", newValue: next }));
    }
    onToggleLang?.();
  };

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
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!logoFailed ? (
          <Image
            src="/logo.png"
            alt="Tactic Portal"
            width={200}
            height={60}
            priority
            style={{ height: 56, width: "auto" }}
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
          <span suppressHydrationWarning>
            {langIsArabic ? "الموقع التعريفي" : "Company Site"}
          </span>
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
            <span suppressHydrationWarning>
              {langIsArabic ? "تسجيل الخروج" : "Logout"}
            </span>
          </button>
        )}

        <button
          onClick={handleToggleLang}
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
          <span suppressHydrationWarning>
            {langIsArabic ? "EN" : "AR"}
          </span>
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
          <span suppressHydrationWarning>
            {theme === "dark" ? (langIsArabic ? "فاتح" : "Light") : (langIsArabic ? "داكن" : "Dark")}
          </span>
        </button>
      </div>
    </div>
  );
}
