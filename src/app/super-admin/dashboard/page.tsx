/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import AppHeader from "@/components/AppHeader";

type PortalUser = {
  id: string;
  role: string;
  username?: string;
  name?: string | null;
  arabic_name?: string | null;
  [key: string]: unknown;
};

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [isArabic, setIsArabic] = useState(
    (typeof window !== "undefined" && localStorage.getItem("lang") === "en") ? false : true
  );
  const [user, setUser] = useState<PortalUser | null>(null);
  const [profile, setProfile] = useState<Pick<PortalUser, "name" | "arabic_name"> | null>(null);

  // ✅ Gate: لازم يكون الدور super_admin — لو admin نحوله لصفحة الأدمن — ولو مفيش يوزر نرجّع للّوجن
  useEffect(() => {
    const raw =
      (typeof window !== "undefined" && localStorage.getItem("currentUser")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("currentUser"));
    if (!raw) {
      router.replace("/login");
      return;
    }
    const u: PortalUser = JSON.parse(raw);
    const role = String(u?.role || "").toLowerCase();
    if (role === "admin") {
      router.replace("/admin/dashboard");
      return;
    }
    if (role !== "super_admin") {
      router.replace("/login");
      return;
    }
    setUser(u);
  }, [router]);

  // 🔎 جبنا الاسم العربي/الإنجليزي من جدول Users (لو مش محفوظين كاملين في currentUser)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("Users")
        .select("name, arabic_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setProfile({ name: data.name ?? null, arabic_name: data.arabic_name ?? null });
      else setProfile({ name: user.name ?? user.username ?? "", arabic_name: (user as any)?.arabic_name ?? null });
    };
    if (user) fetchProfile();
  }, [user]);

  const displayName = useMemo(() => {
    if (!profile) return "";
    if (isArabic) return profile.arabic_name || profile.name || "";
    return profile.name || profile.arabic_name || "";
  }, [profile, isArabic]);

  if (!user) {
    return <div style={{ color: "#fff", padding: 24 }}>Loading…</div>;
  }

  // ⬜️ أزرار الماكيت (حالياً بدون تنقّل؛ هنربطها لاحقًا)
  const buttons = [
    "ALL CLIENTS REPORTS",
    "ADD NEW CLIENT",
    "ADD NEW USER FOR CHOSEN CLIENT",
    "ADD PRODUCTS FOR CHOSEN CLIENT",
    "ADD FEATURES FOR CLIENT",
    "ADD MARKETS FOR CLIENT",
    "ADD VISIT FOR SELECTED USER - CLIENT",
    "PREPARE REPORTING",
    "CLIENT STOP",
    "ADD ADMINS FOR CLIENT",
  ];

  const buttonStyle: React.CSSProperties = {
    backgroundColor: "#555",          // رمادي داخلي
    color: "#ddd",
    padding: "14px 18px",
    border: "2px solid #f5a623",      // إطار ذهبي
    borderRadius: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    minWidth: 280,
    cursor: "pointer",
    boxShadow: "0 0 0 2px #2b2b2b inset",
  };

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff" }}>
      {/* هيدر موحد (رمادي غامق) + زر Logout جاهز */}
      <AppHeader
        isArabic={isArabic}
        onToggleLang={() => setIsArabic((s) => !s)}
        showLogout={true}
      />

      {/* العنوان */}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <h2 style={{ fontWeight: 600 }}>
          {isArabic ? "مرحباً" : "Welcome"} ({displayName || (isArabic ? "اسم المستخدم" : "User Name")})
        </h2>
      </div>

      {/* شبكة الأزرار */}
      <div
        style={{
          maxWidth: 980,
          margin: "24px auto 60px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          alignItems: "stretch",
          justifyItems: "center",
        }}
      >
        {buttons.map((label) => (
          <button
            key={label}
            style={buttonStyle}
            onClick={() => {
              // Placeholder: هنربط المسارات لاحقًا حسب توجيهك
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* فوتر بسيط زي الصورة */}
      <div style={{ textAlign: "center", color: "#bbb", fontSize: 12, paddingBottom: 18 }}>
        {isArabic
          ? "جميع الحقوق محفوظة لشركة Tactic & creativity"
          : "all right reserved for Tactic & creativity"}
      </div>
    </div>
  );
}
