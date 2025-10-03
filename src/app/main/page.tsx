/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import AppHeader from "@/components/AppHeader";

/* ========= Supabase client ========= */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/* ========= Types ========= */
type ClientRow = {
  id: string;
  name: string;
  name_ar?: string | null;
  logo_url?: string | null;
  linked_users: string[];
};

export default function MainPage() {
  const router = useRouter();

  /* ========= App state ========= */
  const [user, setUser] = useState<any>(null);

  // اللغة
  const [isArabic, setIsArabic] = useState<boolean>(() =>
    typeof window !== "undefined" ? localStorage.getItem("lang") === "ar" : false
  );

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // فلاتر
  const [regions, setRegions] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<{ username: string }[]>([]);

  // ✅ القيم المختارة (كانت ناقصة)
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [selectedTeamLeader, setSelectedTeamLeader] = useState<string>("");

  // بيانات العميل
  const [client, setClient] = useState<ClientRow | null>(null);

  /* ========= Helpers ========= */
  const toPublicUrl = (raw?: string | null) => {
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    return `${base}/storage/v1/object/public/avatars/${raw}`;
  };

  /* ========= Auth / user ========= */
  useEffect(() => {
    const savedUser = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
    if (!savedUser) {
      router.push("/login");
      return;
    }
    try {
      setUser(JSON.parse(savedUser));
    } catch {
      router.push("/login");
    }
  }, [router]);

  /* ========= Fetch client linked to user ========= */
  useEffect(() => {
    const run = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from("client")
        .select("id,name,name_ar,logo_url,linked_users")
        .contains("linked_users", [user.id])
        .limit(1);

      if (!error && data && data.length > 0) {
        setClient(data[0] as ClientRow);
      }
    };
    run();
  }, [user?.id]);

  /* ========= Fetch filters ========= */
  useEffect(() => {
    const fetchFilters = async () => {
      const { data: regionsData } = await supabase.from("Markets").select("region").neq("region", "");
      const { data: citiesData } = await supabase.from("Markets").select("city").neq("city", "");
      const { data: marketsData } = await supabase.from("Markets").select("name").neq("name", "");
      const { data: teamLeadersData } = await supabase.from("Users").select("username").eq("role", "Team Leader");

      setRegions([...(new Set((regionsData || []).map((r: any) => r.region)))]);
      setCities([...(new Set((citiesData || []).map((c: any) => c.city)))]);
      setMarkets([...(new Set((marketsData || []).map((m: any) => m.name)))]);
      setTeamLeaders((teamLeadersData || []) as any[]);
    };
    fetchFilters();
  }, []);

  /* ========= Handlers ========= */
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  const handleDateChange = useCallback(() => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      alert("⚠️ تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية");
      setDateFrom("");
      setDateTo("");
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    handleDateChange();
  }, [handleDateChange]);

  const toggleLang = () => {
    setIsArabic((v) => {
      const next = !v;
      if (typeof window !== "undefined") {
        localStorage.setItem("lang", next ? "ar" : "en");
        document.documentElement.dir = next ? "rtl" : "ltr";
      }
      return next;
    });
  };

  /* ========= Derivations ========= */
  const clientDisplayName = useMemo(() => {
    const fallback = isArabic ? "اسم الشركة" : "Company Name";
    if (!client) return fallback;
    return isArabic ? client.name_ar || client.name || fallback : client.name || client.name_ar || fallback;
  }, [client, isArabic]);

  const clientLogoUrl = useMemo(() => toPublicUrl(client?.logo_url), [client?.logo_url]);

  /* ========= Data (mock) ========= */
  const stats = [
    { value: 519, label: "Total Visits", percentage: 70 },
    { value: 411, label: "Completed Visits", percentage: 55 },
    { value: 108, label: "False Visits", percentage: 25 },
    { value: 79, label: "Completed %", percentage: 79 },
    { value: 21, label: "False %", percentage: 21 },
    { value: 22, label: "Total Available", percentage: 80 },
    { value: 34, label: "Total Items", percentage: 65 }, // الكارت الجديد
    { value: 11, label: "Not Available", percentage: 30 },
    { value: "00:00", label: "Avg Visit Time", percentage: 65 },
    { value: "00:00", label: "Total Travel Time", percentage: 50 },
  ];

  if (!user) {
    return <p style={{ padding: "2rem" }}>Loading...</p>;
  }

  /* ========= UI ========= */
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <AppHeader isArabic={isArabic} onToggleLang={toggleLang} showLogout className="app-header" />

      {/* Welcome + client logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          borderBottom: "1px solid var(--divider)",
          background: "var(--card)",
        }}
      >
        {clientLogoUrl ? (
          <Image src={clientLogoUrl} alt="Client Logo" width={48} height={48} style={{ borderRadius: 8, objectFit: "contain" }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--chip-bg)", border: "1px solid var(--divider)" }} />
        )}

        <div style={{ lineHeight: 1.3 }}>
          <div style={{ fontWeight: 700 }}>{isArabic ? "مرحبًا" : "Welcome"} {user?.username ?? ""}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{clientDisplayName}</div>
        </div>

        <div style={{ marginInlineStart: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={handleLogout}
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", padding: "8px 12px", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
          >
            {isArabic ? "تسجيل الخروج" : "Logout"}
          </button>
          <button
            onClick={toggleLang}
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", padding: "8px 12px", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
          >
            {isArabic ? "EN" : "AR"}
          </button>
        </div>
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, padding: 20, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
        <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} style={selectStyle}>
          <option value="">{isArabic ? "المنطقة" : "Region"}</option>
          {regions.map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>

        <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} style={selectStyle}>
          <option value="">{isArabic ? "المدينة" : "City"}</option>
          {cities.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>

        <select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)} style={selectStyle}>
          <option value="">{isArabic ? "السوق" : "Market"}</option>
          {markets.map((m) => (<option key={m} value={m}>{m}</option>))}
        </select>

        <select value={selectedTeamLeader} onChange={(e) => setSelectedTeamLeader(e.target.value)} style={selectStyle}>
          <option value="">{isArabic ? "قائد الفريق" : "Team Leader"}</option>
          {teamLeaders.map((t) => (<option key={t.username} value={t.username}>{t.username}</option>))}
        </select>

        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={dateStyle} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={dateStyle} />
      </div>

      <hr style={{ margin: "0 20px 20px", border: "none", borderTop: "1px solid var(--divider)" }} />

      {/* Stats rows */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 20, marginBottom: 20 }}>
        {stats.slice(0, 5).map((stat, idx) => (<StatCard key={`top-${idx}`} stat={stat} isArabic={isArabic} />))}
      </div>

      <hr style={{ margin: "0 20px 20px", border: "none", borderTop: "1px solid var(--divider)" }} />

      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 20, marginBottom: 20 }}>
        {stats.slice(5).map((stat, idx) => (<StatCard key={`bottom-${idx}`} stat={stat} isArabic={isArabic} />))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", paddingBottom: 32 }}>
        <button style={primaryBtnStyle}>{isArabic ? "إرسال الإشعارات" : "Send Notifications"}</button>
        <button style={primaryBtnStyle}>{isArabic ? "التقارير المفصلة" : "Detailed Reports"}</button>
      </div>
    </div>
  );
}

/* ========= Small components & styles ========= */

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--input-text)",
  minWidth: 180,
};

const dateStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--input-text)",
};

const primaryBtnStyle: React.CSSProperties = {
  backgroundColor: "var(--accent)",
  color: "var(--accent-foreground)",
  padding: "10px 16px",
  border: "none",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};

function StatCard({
  stat,
  isArabic,
}: {
  stat: { value: number | string; label: string; percentage: number };
  isArabic: boolean;
}) {
  const labels: Record<string, string> = {
    "Total Visits": isArabic ? "إجمالي الزيارات" : "Total Visits",
    "Completed Visits": isArabic ? "الزيارات المكتملة" : "Completed Visits",
    "False Visits": isArabic ? "زيارات وهمية" : "False Visits",
    "Completed %": isArabic ? "نسبة الإكمال" : "Completed %",
    "False %": isArabic ? "نسبة الوهمية" : "False %",
    "Total Available": isArabic ? "إجمالي المتاح" : "Total Available",
    "Not Available": isArabic ? "غير متاح" : "Not Available",
    "Avg Visit Time": isArabic ? "متوسط وقت الزيارة" : "Avg Visit Time",
    "Total Travel Time": isArabic ? "إجمالي وقت التنقل" : "Total Travel Time",
    "Total Items": isArabic ? "إجمالي الأصناف" : "Total Items",
  };

  return (
    <div style={{ width: 160, textAlign: "center", backgroundColor: "var(--card)", border: "1px solid var(--divider)", borderRadius: 12, padding: 14 }}>
      <div style={{ width: 110, height: 110, margin: "0 auto" }}>
        <CircularProgressbar
          value={typeof stat.percentage === "number" ? stat.percentage : 0}
          text={`${stat.value}`}
          styles={buildStyles({
            textColor: "var(--text)",
            pathColor: "var(--accent)",
            trailColor: "var(--chip-bg)",
          })}
        />
      </div>
      <p style={{ marginTop: 10, fontSize: 13 }}>{labels[stat.label] ?? stat.label}</p>
    </div>
  );
}
