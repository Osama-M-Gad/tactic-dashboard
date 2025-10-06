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
};

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [isArabic, setIsArabic] = useState(
    (typeof window !== "undefined" && localStorage.getItem("lang") === "en") ? false : true
  );
  const [user, setUser] = useState<PortalUser | null>(null);
  const [profile, setProfile] = useState<Pick<PortalUser, "name" | "arabic_name"> | null>(null);

  // ✅ Gate
  useEffect(() => {
    const raw =
      (typeof window !== "undefined" && localStorage.getItem("currentUser")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("currentUser"));
    if (!raw) {
      router.replace("/login");
      return;
    }
    const u = JSON.parse(raw) as PortalUser;
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

  // 🔎 جلب الاسم العربي/الإنجليزي
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("Users")
        .select("name, arabic_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setProfile({ name: data.name ?? null, arabic_name: data.arabic_name ?? null });
      else setProfile({ name: user.name ?? user.username ?? "", arabic_name: user.arabic_name ?? null });
    };
    if (user) fetchProfile();
  }, [user]);

  const displayName = useMemo(() => {
    if (!profile) return "";
    return isArabic ? (profile.arabic_name || profile.name || "") : (profile.name || profile.arabic_name || "");
  }, [profile, isArabic]);

  // 🌐 نصوص AR/EN
  const T = useMemo(() => {
    return isArabic
      ? {
          welcome: "مرحباً",
          footer: "جميع الحقوق محفوظة لشركة Tactic & creativity",
          buttons: [
            "تقارير كل العملاء",
            "إضافة عميل جديد",
            "إضافة مستخدم لعميل محدد",
            "إضافة منتجات لعميل محدد",
            "إضافة خواص/مميزات للعميل",
            "إضافة أسواق للعميل",
            "إضافة زيارة لمستخدم محدد - عميل",
            "تحضير التقارير",
            "إيقاف عميل",
            "إضافة مديرين للعميل",
            "إدخال أسواق (بصفة عامة)", 
            "إدخال فئات (بصفة عامة)",
          ],
        }
      : {
          welcome: "Welcome",
          footer: "all right reserved for Tactic & creativity",
          buttons: [
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
             "ADD MARKETS (GENERAL)",
             "ADD CATEGORIES (GENERAL)",
          ],
        };
  }, [isArabic]);

  if (!user) {
    return <div style={{ color: "#fff", padding: 24 }}>Loading…</div>;
  }

  // 🎨 ستايل موحّد للأزرار
  const buttonStyle: React.CSSProperties = {
    backgroundColor: "#555",
    color: "#ddd",
    padding: "14px 18px",
    border: "2px solid #f5a623",
    borderRadius: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    minWidth: 280,
    cursor: "pointer",
    boxShadow: "0 0 0 2px #2b2b2b inset",
  };

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column" }}>
      <AppHeader
        onToggleLang={() => setIsArabic((s) => !s)}
        showLogout={true}
      />

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <h2 style={{ fontWeight: 600 }}>
          {T.welcome} ({displayName || (isArabic ? "اسم المستخدم" : "User Name")})
        </h2>
      </div>

      {/* شبكة الأزرار */}
      <div
        style={{
          maxWidth: 980,
          margin: "24px auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          width: "100%",
          padding: "0 20px",
          flexGrow: 1,
        }}
      >
        {T.buttons.map((label) => (
          <button
            key={label}
            style={{ ...buttonStyle, width: "100%", height: 70 }}
            onClick={() => {
  if (label === "ADD NEW CLIENT" || label === "إضافة عميل جديد") {
    router.push("/super-admin/clients/new");
  } else {
    // لاحقًا هنربط باقي الأزرار
  }
}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* فوتر مثبت أسفل */}
      <div style={{ textAlign: "center", color: "#bbb", fontSize: 12, padding: "18px 0", marginTop: "auto" }}>
        {T.footer}
      </div>
    </div>
  );
}
