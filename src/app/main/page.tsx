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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  const handleDateChange = () => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      alert("⚠️ تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية");
      setDateFrom("");
      setDateTo("");
    }
  };

  useEffect(() => {
    handleDateChange();
  }, [dateFrom, dateTo]);

  if (!user) {
    return <p style={{ padding: "2rem" }}>Loading...</p>;
  }

  // ترجمة العناوين
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
          style={{ height: "75px" }}
        />

        <div style={{ textAlign: "center", flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
          <p style={{ margin: 0 }}>
            {isArabic ? `مرحباً ${user.username} - اسم الشركة` : `Welcome ${user.username} - Company Name`}
          </p>
          <img
            src="https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files/company-logo.png"
            alt="Company Logo"
            style={{ height: "30px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={handleLogout}
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
            {isArabic ? "تسجيل الخروج" : "Logout"}
          </button>
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
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "center", flexWrap: "wrap" }}>
        {["Region", "City", "Market", "Team Leader"].map((filter) => (
          <select key={filter} style={{ padding: "5px", borderRadius: "4px", color: "#000" }}>
            <option>{filter}</option>
          </select>
        ))}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{ padding: "5px", borderRadius: "4px", color: "#000" }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{ padding: "5px", borderRadius: "4px", color: "#000" }}
        />
      </div>

      {/* Divider */}
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
            <p style={{ marginTop: "10px", fontSize: "13px" }}>{labels[stat.label as keyof typeof labels]}
          </p>
          </div>
        ))}
      </div>

      {/* Divider */}
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
            <p style={{ marginTop: "10px", fontSize: "13px" }}>{labels[stat.label as keyof typeof labels]}
          </p>
          </div>
        ))}
      </div>
      {/* Divider */}
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
