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

  // بيانات مؤقتة للتجربة
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
          style={{ height: "50px" }}
        />
        <p style={{ margin: 0 }}>
          Welcome {user.username} - Company Name
        </p>
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

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
        {["Region", "City", "Market", "Team Leader", "Date From", "Date To"].map((filter) => (
          <select key={filter} style={{ padding: "5px", borderRadius: "4px" }}>
            <option>{filter}</option>
          </select>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginTop: "30px" }}>
        {stats.map((stat, index) => (
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

      {/* Reports Button */}
      <div style={{ marginTop: "30px" }}>
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
          All Reports By Details (Mch, Branches ...etc)
        </button>
      </div>

      {/* Logout */}
      <div style={{ marginTop: "20px" }}>
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
          Logout
        </button>
      </div>
    </div>
  );
}
