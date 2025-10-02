"use client";
import Link from "next/link";
import { useEffect } from "react";
import { logout } from "@/utils/session";
import Image from "next/image";
type Props = {
  isArabic: boolean;
  onToggleLang: () => void;
  showLogout?: boolean; // افتراضي = true
};

export default function AppHeader({ isArabic, onToggleLang, showLogout = true }: Props) {
  // ضبط اتجاه الصفحة وحفظ اللغة
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dir = isArabic ? "rtl" : "ltr";
      localStorage.setItem("lang", isArabic ? "ar" : "en");
    }
  }, [isArabic]);

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#333",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 20px",
      }}
    >
      <Image
  src="/logo.png"
  alt="Logo"
  width={120}
  height={40}
  style={{ height: "40px", width: "auto" }}
  unoptimized // لو الصورة جاية من Supabase Storage أو CDN خارجي
/>

      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <Link
          href="https://www.tai.com.sa"
          target="_blank"
          style={{
            backgroundColor: "#f5a623",
            color: "#000",
            padding: "8px 12px",
            borderRadius: "4px",
            textDecoration: "none",
            fontWeight: "bold",
            fontSize: "0.9rem",
          }}
        >
          {isArabic ? "الموقع التعريفي" : "Company Site"}
        </Link>

        {showLogout && (
          <button
            onClick={logout}
            style={{
              backgroundColor: "#f5a623",
              color: "#000",
              padding: "8px 12px",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
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
            backgroundColor: "#f5a623",
            color: "#000",
            padding: "8px 12px",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          {isArabic ? "EN" : "AR"}
        </button>
      </div>
    </div>
  );
}
