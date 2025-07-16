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

  const handleDateChange = (type: "from" | "to", value: string) => {
    if (type === "from") setDateFrom(value);
    else setDateTo(value);

    if (type === "to" && dateFrom && new Date(value) < new Date(dateFrom)) {
      alert("⚠️ Date To cannot be earlier than Date From!");
    }

    if (type === "from" && dateTo && new Date(value) > new Date(dateTo)) {
      alert("⚠️ Date From cannot be after Date To!");
    }
  };

  if (!user) {
    return <p style={{ padding: "2rem" }}>Loading...</p>;
  }

  // بيانات مؤقتة
  const stats = [
    { value: 519, label: isArabic ? "إجمالي الزيارات" : "Total Visits", percentage: 70 },
    { value: 411, label: isArabic ? "الزيارات المكتملة" : "Completed Visits", percentage: 55 },
    { value: 108, label: isArabic ? "زيارات خاطئة" : "False Visits", percentage: 25 },
    { value: 79, label: isArabic ? "نسبة المكتملة" : "Completed %", percentage: 79 },
    { value: 21, label: isArabic ? "نسبة الخاطئة" : "False %", percentage: 21 },
    { value: 22, label: isArabic ? "الإجمالي المتاح" : "Total Available", percentage: 80 },
    { value: 11, label: isArabic ? "غير متاح" : "Not Available", percentage: 30 },
    { value: "00:00", label: isArabic ? "متوسط وقت الزيارة" : "Avg Visit Time", percentage: 65 },
    { value: "00:00", label: isArabic ? "إجمالي وقت التنقل" : "Total Travel Time", percentage: 50 },
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
          alt="Main Logo"
          style={{ height: "50px" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <p style={{ margin: 0 }}>
            {isArabic ? "مرحباً" : "Welcome"} {user.username} - Company Name
          </p>
          <img
            src="https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files//company-logo.png"
            alt="Company Logo"
            style={{ height: "40px", borderRadius: "4px" }}
          />
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
      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
        {["Region", "City", "Market", "Team Leader"].map((filter) => (
          <select key={filter} style={{ padding: "5px", borderRadius: "4px", color: "#000" }}>
            <option>{isArabic ? "اختيار" : filter}</option>
          </select>
        ))}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => handleDateChange("from", e.target.value)}
          style={{ padding: "5px", borderRadius: "4px", color: "#000" }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => handleDateChange("to", e.target.value)}
          style={{ padding: "5px", borderRadius: "4px", color: "#000" }}
        />
      </div>

      {/* Stats Sections */}
      <div style={{ marginTop: "30px" }}>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "20px", marginBottom: "30px" }}>
          {stats.slice(0, 5).map((stat, index) => (
            <div
              key={index}
              style={{
                width: "120px",
                textAlign: "center",
                backgroundColor: "#111",
                borderRadius: "8px",
                padding: "10px",
              }}
            >
              <div style={{ width: 80, height: 80, margin: "0 auto" }}>
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
              <p style={{ marginTop: "10px", fontSize: "12px" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <hr style={{ border: "1px solid #444", margin: "30px auto", width: "80%" }} />

        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "20px" }}>
          {stats.slice(5).map((stat, index) => (
            <div
              key={index}
              style={{
                width: "120px",
                textAlign: "center",
                backgroundColor: "#111",
                borderRadius: "8px",
                padding: "10px",
              }}
            >
              <div style={{ width: 80, height: 80, margin: "0 auto" }}>
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
              <p style={{ marginTop: "10px", fontSize: "12px" }}>{stat.label}</p>
            </div>
          ))}
        </div>
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
          {isArabic ? "جميع التقارير بالتفاصيل" : "All Reports By Details (Mch, Branches ...etc)"}
        </button>
      </div>

      {/* Logout */}
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <button
          onClick={handleLogout}
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
          {isArabic ? "تسجيل الخروج" : "Logout"}
        </button>
      </div>
    </div>
  );
}