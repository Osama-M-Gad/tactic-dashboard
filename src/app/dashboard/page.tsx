"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      router.push("/login");
    }
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (loading) {
    return <p style={{ padding: "2rem" }}>Loading...</p>;
  }

  return (
    <div style={{ padding: "2rem", color: "#000" }}>
      <h1>Welcome to Dashboard</h1>
      <p>
        Hello, {user?.username}
        <br />
        {/* Role: {user?.role || "User"} */}
      </p>

      <button
        onClick={handleLogout}
        style={{
          marginTop: "20px",
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
  );
}
