/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

export default function MainPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isArabic, setIsArabic] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (!savedUser) {
      router.push("/login");
    } else {
      setUser(JSON.parse(savedUser));
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  if (!user) {
    return <p style={{ padding: "2rem" }}>Loading...</p>;
  }

  // النصوص باللغتين
  const texts = {
    region: isArabic ? "المنطقة" : "Region",
    city: isArabic ? "المدينة" : "City",
    market: isArabic ? "السوق" : "Market",
    leader: isArabic ? "القائد" : "Team Leader",
    dateFrom: isArabic ? "من تاريخ" : "Date From",
    dateTo: isArabic ? "إلى تاريخ" : "Date To",
    reportsBtn: isArabic ? "جميع التقارير بالتفاصيل" : "All Reports By Details (Mch, Branches ...etc)",
    logout: isArabic ? "تسجيل الخروج" : "Logout",
    welcome: isArabic ? `مرحباً ${user.username} - اسم الشركة` : `Welcome ${user.username} - Company Name`,
    totalVisits: isArabic ? "إجمالي الزيارات" : "Total Visits",
    completedVisits: isArabic ? "الزيارات المكتملة" : "Completed Visits",
    falseVisits: isArabic ? "الزيارات الوهمية" : "False Visits",
    completedPerc: isArabic ? "نسبة المكتملة" : "Completed %",
    falsePerc: isArabic ? "نسبة الوهمية" : "False %",
    totalAvailable: isArabic ? "الإجمالي المتاح" : "Total Available",
    notAvailable: isArabic ? "غير متاح" : "Not Available",
    avgTime: isArabic ? "متوسط وقت الزيارة" : "Avg Visit Time",
    travelTime: isArabic ? "وقت التنقل" : "Total Travel Time",
  };

  const statsRow1 = [
    { value: 519, label: texts.totalVisits, percentage: 70 },
    { value: 411, label: texts.completedVisits, percentage: 55 },
    { value: 108, label: texts.falseVisits, percentage: 25 },
    { value: 79, label: texts.completedPerc, percentage: 79 },
    { value: 21, label: texts.falsePerc, percentage: 21 },
  ];

  const statsRow2 = [
    { value: 22, label: texts.totalAvailable, percentage: 80 },
    { value: 11, label: texts.notAvailable, percentage: 30 },
    { value: "00:00", label: texts.avgTime, percentage: 65 },
    { value: "00:00", label: texts.travelTime, percentage: 50 },
  ];

  return (
    <div style={{ backgroundColor: "#000", color: "#fff", minHeight: "100vh", padding: "20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#444",
          padding: "10px 20px",
        }}
      >
        <img
          src="https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files//logo.png"
          alt="Logo"
          style={{ height: "50px" }}
        />

        <p style={{ margin: 0 }}>{texts.welcome}</p>

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              backgroundColor: "#ccc",
              cursor: "pointer",
            }}
          ></div>
          <button
            onClick={() => setIsArabic(!isArabic)}
            style={{
              backgroundColor: "#f5a623",
              color: "#000",
              border: "none",
              borderRadius: "4px",
              padding: "5px 10px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isArabic ? "EN" : "AR"}
          </button>

          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "40px",
                right: 0,
                backgroundColor: "#222",
                padding: "10px",
                borderRadius: "4px",
                zIndex: 100,
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  backgroundColor: "#f5a623",
                  color: "#000",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {texts.logout}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "center", flexWrap: "wrap" }}>
        {[texts.region, texts.city, texts.market, texts.leader, texts.dateFrom, texts.dateTo].map((filter) => (
          <select
            key={filter}
            style={{
              padding: "10px",
              borderRadius: "4px",
              backgroundColor: "#fff",
              color: "#000",
              minWidth: "120px",
            }}
          >
            <option>{filter}</option>
          </select>
        ))}
      </div>

      {/* Stats Row 1 */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "20px", marginTop: "30px" }}>
        {statsRow1.map((stat, index) => (
          <div
            key={index}
            style={{
              width: "150px",
              textAlign: "center",
              backgroundColor: "#111",
              borderRadius: "8px",
              padding: "10px",
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
            <p style={{ marginTop: "10px", fontSize: "13px" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Stats Row 2 */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "20px", marginTop: "20px" }}>
        {statsRow2.map((stat, index) => (
          <div
            key={index}
            style={{
              width: "150px",
              textAlign: "center",
              backgroundColor: "#111",
              borderRadius: "8px",
              padding: "10px",
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
            <p style={{ marginTop: "10px", fontSize: "13px" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Reports Button */}
      <div style={{ marginTop: "30px", textAlign: "center" }}>
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
          {texts.reportsBtn}
        </button>
      </div>
    </div>
  );
}
