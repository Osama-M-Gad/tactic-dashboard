"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MainPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isArabic, setIsArabic] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (!savedUser) {
      router.push("/login");
    } else {
      setUser(JSON.parse(savedUser));
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  const toggleLanguage = () => {
    setIsArabic(!isArabic);
  };

  if (loading) {
    return <p style={{ padding: "2rem" }}>Loading...</p>;
  }

  return (
    <div style={{ padding: "1rem", direction: isArabic ? "rtl" : "ltr" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <img
          src="https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files//logo.png"
          alt="Company Logo"
          style={{ height: "60px" }}
        />

        <button
          onClick={toggleLanguage}
          style={{
            backgroundColor: "#f5a623",
            color: "#000",
            padding: "6px 12px",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {isArabic ? "EN" : "AR"}
        </button>
      </div>

      {/* Welcome */}
      <h2>
        {isArabic
          ? `مرحبًا ${user.username} - ${user.company_name || "اسم الشركة"}`
          : `Welcome ${user.username} - ${user.company_name || "Company Name"}`}
      </h2>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "1rem",
          marginBottom: "1rem",
        }}
      >
        <select style={{ padding: "8px", borderRadius: "4px" }}>
          <option>{isArabic ? "المنطقة" : "Region"}</option>
        </select>
        <select style={{ padding: "8px", borderRadius: "4px" }}>
          <option>{isArabic ? "المدينة" : "City"}</option>
        </select>
        <select style={{ padding: "8px", borderRadius: "4px" }}>
          <option>{isArabic ? "السوق" : "Market"}</option>
        </select>
        <select style={{ padding: "8px", borderRadius: "4px" }}>
          <option>{isArabic ? "قائد الفريق" : "Team Leader"}</option>
        </select>
        <input type="date" style={{ padding: "8px", borderRadius: "4px" }} />
        <input type="date" style={{ padding: "8px", borderRadius: "4px" }} />
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "10px",
        }}
      >
        <div style={{ background: "#f5a623", padding: "1rem", borderRadius: "6px" }}>
          <h4>{isArabic ? "إجمالي الزيارات" : "Total Visits"}</h4>
          <p>150</p>
        </div>
        <div style={{ background: "#f5a623", padding: "1rem", borderRadius: "6px" }}>
          <h4>{isArabic ? "الزيارات المكتملة" : "Completed Visits"}</h4>
          <p>120</p>
        </div>
        <div style={{ background: "#f5a623", padding: "1rem", borderRadius: "6px" }}>
          <h4>{isArabic ? "زيارات خطأ" : "False Visits"}</h4>
          <p>30</p>
        </div>
        <div style={{ background: "#f5a623", padding: "1rem", borderRadius: "6px" }}>
          <h4>{isArabic ? "نسبة المكتملة" : "Completed %"}</h4>
          <p>80%</p>
        </div>
        <div style={{ background: "#f5a623", padding: "1rem", borderRadius: "6px" }}>
          <h4>{isArabic ? "نسبة الخطأ" : "False %"}</h4>
          <p>20%</p>
        </div>
        <div style={{ background: "#f5a623", padding: "1rem", borderRadius: "6px" }}>
          <h4>{isArabic ? "إجمالي المتاح" : "Total Available Items"}</h4>
          <p>500</p>
        </div>
        <div style={{ background: "#f5a623", padding: "1rem", borderRadius: "6px" }}>
          <h4>{isArabic ? "غير متاح" : "Not Available Items"}</h4>
          <p>50</p>
        </div>
        <div style={{ background: "#f5a623", padding: "1rem", borderRadius: "6px" }}>
          <h4>{isArabic ? "متوسط وقت الزيارة" : "Avg Visit Time"}</h4>
          <p>00:45</p>
        </div>
        <div style={{ background: "#f5a623", padding: "1rem", borderRadius: "6px" }}>
          <h4>{isArabic ? "إجمالي وقت التنقل" : "Total Travel Time"}</h4>
          <p>01:20</p>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ marginTop: "2rem" }}>
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            backgroundColor: "#000",
            color: "#f5a623",
            padding: "10px 20px",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {isArabic ? "كل التقارير بالتفاصيل" : "All Reports By Details"}
        </button>
      </div>

      {/* Logout */}
      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: "#f5a623",
            color: "#000",
            padding: "8px 16px",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {isArabic ? "تسجيل الخروج" : "Logout"}
        </button>
      </div>
    </div>
  );
}
