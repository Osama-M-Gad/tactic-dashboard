"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    };

    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return <p style={{ padding: "2rem" }}>Loading...</p>;
  }

  return (
    <div style={{ padding: "2rem", color: "#000" }}>
      <h1>Welcome to Dashboard</h1>
      <p>
        Hello, {user?.email}
        <br />
        {/* هنا لو عايز تعرض صلاحياته مثلا */}
        {/* Role: {user?.user_metadata?.role || "User"} */}
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
