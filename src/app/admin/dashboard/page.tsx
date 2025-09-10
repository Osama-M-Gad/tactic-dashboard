/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { getSupabaseClient } from "@/utils/supabaseClient"; // توحيد العميل
import AppHeader from "@/components/AppHeader";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isArabic, setIsArabic] = useState(
    (typeof window !== "undefined" && localStorage.getItem("lang") === "en") ? false : true
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // فلترز
  const [regions, setRegions] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);

  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedMarket, setSelectedMarket] = useState("");
  const [selectedTeamLeader, setSelectedTeamLeader] = useState("");

  // ✅ Gate: السماح فقط لـ admin — السوبر يوجّه لصفحته — والباقي Login
  useEffect(() => {
    const stored =
      (typeof window !== "undefined" && localStorage.getItem("currentUser")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("currentUser"));

    if (!stored) {
      router.replace("/login");
      return;
    }

    const u = JSON.parse(stored);
    const role = String(u?.role || "").toLowerCase();

    if (role === "super_admin") {
      router.replace("/super-admin/dashboard");
      return;
    }

    if (role !== "admin") {
      // أي دور آخر غير مسموح له هنا
      router.replace("/login");
      return;
    }

    setUser(u);
  }, [router]);

  // تحميل الفلاتر (دعم حالتين لحقل الدور في Users)
  useEffect(() => {
      const fetchFilters = async () => {
        const supabase = getSupabaseClient();
        const { data: regionsData } = await supabase.from("Markets").select("region").neq("region", "");
        const { data: citiesData } = await supabase.from("Markets").select("city").neq("city", "");
        const { data: marketsData } = await supabase.from("Markets").select("name").neq("name", "");
        const { data: teamLeadersData } = await supabase
          .from("Users")
          .select("username")
          .in("role", ["team_leader", "Team Leader"]); // دعم الشكلين

      setRegions([...(new Set(regionsData?.map((r) => r.region)))]);
      setCities([...(new Set(citiesData?.map((c) => c.city)))]);
      setMarkets([...(new Set(marketsData?.map((m) => m.name)))]);
      setTeamLeaders(teamLeadersData || []);
    };

    fetchFilters();
  }, []);

  // التحقق من التاريخ
  useEffect(() => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      alert(isArabic ? "⚠️ تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية" : "⚠️ From date cannot be after To date");
      setDateFrom("");
      setDateTo("");
    }
  }, [dateFrom, dateTo, isArabic]);

  if (!user) {
    return <p style={{ padding: "2rem" }}>{isArabic ? "جارٍ التحميل..." : "Loading..."}</p>;
    // ملاحظة: سيستبدلها التوجيه أعلاه إذا ليس Admin
  }

  const labels = {
    "Total Visits": isArabic ? "إجمالي الزيارات" : "Total Visits",
    "Completed Visits": isArabic ? "الزيارات المكتملة" : "Completed Visits",
    "False Visits": isArabic ? "زيارات وهمية" : "False Visits",
    "Completed %": isArabic ? "نسبة الإكمال" : "Completed %",
    "False %": isArabic ? "نسبة الوهمية" : "False %",
    "Total Available": isArabic ? "إجمالي المتاح" : "Total Available",
    "Not Available": isArabic ? "غير متاح" : "Not Available",
    "Avg Visit Time": isArabic ? "متوسط وقت الزيارة" : "Avg Visit Time",
    "Total Travel Time": isArabic ? "إجمالي وقت التنقل" : "Total Travel Time",
  };

  // مؤقتًا: أرقام ثابتة كما في صفحتك الأصلية
  const stats = [
    { value: 519, label: "Total Visits", percentage: 70 },
    { value: 411, label: "Completed Visits", percentage: 55 },
    { value: 108, label: "False Visits", percentage: 25 },
    { value: 79, label: "Completed %", percentage: 79 },
    { value: 21, label: "False %", percentage: 21 },
    { value: 22, label: "Total Available", percentage: 80 },
    { value: 11, label: "Not Available", percentage: 30 },
    { value: "00:00", label: "Avg Visit Time", percentage: 65 },
    { value: "00:00", label: "Total Travel Time", percentage: 50 },
  ];

  return (
    <div style={{ backgroundColor: "#000", color: "#fff", minHeight: "100vh", padding: "20px" }}>
      {/* ✅ الهيدر الموحّد (بدون Logout الآن — هنضيفه في الخطوة التالية) */}
      <AppHeader
  isArabic={isArabic}
  onToggleLang={() => setIsArabic((s) => !s)}
  showLogout={true}
/>
      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "center", flexWrap: "wrap" }}>
        <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} style={{ padding: "5px", borderRadius: "4px", color: "#000" }}>
          <option value="">{isArabic ? "المنطقة" : "Region"}</option>
          {regions.map((region, i) => (
            <option key={i} value={region}>{region}</option>
          ))}
        </select>

        <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} style={{ padding: "5px", borderRadius: "4px", color: "#000" }}>
          <option value="">{isArabic ? "المدينة" : "City"}</option>
          {cities.map((city, i) => (
            <option key={i} value={city}>{city}</option>
          ))}
        </select>

        <select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)} style={{ padding: "5px", borderRadius: "4px", color: "#000" }}>
          <option value="">{isArabic ? "السوق" : "Market"}</option>
          {markets.map((market, i) => (
            <option key={i} value={market}>{market}</option>
          ))}
        </select>

        <select value={selectedTeamLeader} onChange={(e) => setSelectedTeamLeader(e.target.value)} style={{ padding: "5px", borderRadius: "4px", color: "#000" }}>
          <option value="">{isArabic ? "قائد الفريق" : "Team Leader"}</option>
          {teamLeaders.map((leader, i) => (
            <option key={i} value={leader.username}>{leader.username}</option>
          ))}
        </select>

        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "5px", borderRadius: "4px", color: "#000" }} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "5px", borderRadius: "4px", color: "#000" }} />
      </div>

      <hr style={{ margin: "30px 0", borderColor: "#555" }} />

      {/* Stats - First row */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
        {stats.slice(0, 5).map((stat, index) => (
          <div
            key={index}
            style={{
              width: "150px",
              textAlign: "center",
              backgroundColor: "#111",
              borderRadius: "8px",
              padding: "15px",
            }}
          >
            <div style={{ width: 100, height: 100, margin: "0 auto" }}>
              <CircularProgressbar
                value={typeof stat.percentage === "number" ? stat.percentage : 0}
                text={`${stat.value}`}
                styles={buildStyles({
                  textColor: "#fff",
                  pathColor: "#f5a623",
                  trailColor: "#333",
                })}
              />
            </div>
            <p style={{ marginTop: "10px", fontSize: "13px" }}>{labels[stat.label as keyof typeof labels]}</p>
          </div>
        ))}
      </div>

      <hr style={{ margin: "30px 0", borderColor: "#555" }} />

      {/* Stats - Second row */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
        {stats.slice(5).map((stat, index) => (
          <div
            key={index}
            style={{
              width: "150px",
              textAlign: "center",
              backgroundColor: "#111",
              borderRadius: "8px",
              padding: "15px",
            }}
          >
            <div style={{ width: 100, height: 100, margin: "0 auto" }}>
              <CircularProgressbar
                value={typeof stat.percentage === "number" ? stat.percentage : 0}
                text={`${stat.value}`}
                styles={buildStyles({
                  textColor: "#fff",
                  pathColor: "#f5a623",
                  trailColor: "#333",
                })}
              />
            </div>
            <p style={{ marginTop: "10px", fontSize: "13px" }}>{labels[stat.label as keyof typeof labels]}</p>
          </div>
        ))}
      </div>

      <hr style={{ margin: "30px 0", borderColor: "#555" }} />

      {/* Reports Button */}
      <div style={{ textAlign: "center", marginTop: "30px" }}>
        <button
          style={{
            backgroundColor: "#f5a623",
            color: "#000",
            padding: "10px 20px",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {isArabic ? "جميع التقارير بالتفصيل (MCH، الفروع ...الخ)" : "All Reports By Details (Mch, Branches ...etc)"}
        </button>
      </div>
    </div>
  );
}
