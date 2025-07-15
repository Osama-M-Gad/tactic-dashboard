"use client";
const [user, setUser] = useState<{ username: string; role?: string } | null>(null);

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const getUser = async () => {
      const savedUser = localStorage.getItem("currentUser");
      if (!savedUser) {
        router.push("/login");
      } else {
        setUser(JSON.parse(savedUser));
        setLoading(false);
      }
    };

    getUser();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
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
