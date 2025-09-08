"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function LoginPage() {
  const [isArabic, setIsArabic] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggleLanguage = () => setIsArabic((s) => !s);

  const TEXT = {
    wrong: isArabic ? "البيانات غلط" : "Invalid username or password",
  };

  // يقرأ المستخدم من localStorage ثم sessionStorage
  function getStoredUser(): any | null {
    try {
      const ls = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
      if (ls) return JSON.parse(ls);
      const ss = typeof window !== "undefined" ? sessionStorage.getItem("currentUser") : null;
      if (ss) return JSON.parse(ss);
      return null;
    } catch {
      return null;
    }
  }

  // يقرر مسار التحويل حسب الدور
  function routeByRole(user: any) {
    const role = String(user?.role || "").toLowerCase();
    if (role === "super_admin") router.replace("/super-admin/dashboard");
    else if (role === "admin") router.replace("/admin/dashboard");
  }

  // Auto-redirect إذا كانت جلسة محفوظة
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) routeByRole(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    setErrorMsg("");
    setLoading(true);

    try {
      // التحقق من المستخدم في جدول Users (حسب تصميمك الحالي)
      const { data, error } = await supabase
        .from("Users")
        .select("*")
        .eq("username", username.trim())
        .eq("password", password)
        .single();

      if (error || !data) {
        setErrorMsg(TEXT.wrong);
        return;
      }

      const role = String(data.role || "").toLowerCase();
      const isSuper = role === "super_admin";
      const isAdmin = role === "admin";
      if (!isSuper && !isAdmin) {
        setErrorMsg(TEXT.wrong);
        return;
      }

      // حفظ الجلسة محليًا
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("currentUser", JSON.stringify(data));
      storage.setItem("rememberMe", rememberMe ? "1" : "0");

      // تسجيل جلسة في user_sessions
      const sessionKey = crypto.randomUUID();
      await supabase.from("user_sessions").insert({
        user_id: data.id,
        session_key: sessionKey,
        platform: "web",
        app_version: "portal-v1",
      });
      storage.setItem("session_key", sessionKey);

      // توجيه حسب الدور
      if (isSuper) router.push("/super-admin/dashboard");
      else router.push("/admin/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundImage:
          "url('https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files//bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div
        style={{
          width: "100%",
          backgroundColor: "rgba(0,0,0,0.8)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 20px",
        }}
      >
        <img
          src="https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files//logo.png"
          alt="Tactic Logo"
          style={{ height: "75px" }}
        />

        <div style={{ display: "flex", gap: "10px" }}>
          <a
            href="https://www.tai.com.sa"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              backgroundColor: "#f5a623",
              color: "#000",
              padding: "8px 12px",
              borderRadius: "4px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "0.9rem",
            }}
          >
            {isArabic ? "الموقع التعريفي" : "Company Site"}
          </a>
          <button
            onClick={toggleLanguage}
            style={{
              backgroundColor: "#f5a623",
              color: "#000",
              padding: "8px 12px",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            {isArabic ? "EN" : "AR"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "calc(100vh - 60px)",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: "2rem",
            borderRadius: "8px",
            width: "350px",
            textAlign: "center",
          }}
        >
          <img
            src="https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files//logo.png"
            alt="Tactic Logo"
            style={{
              width: "200px",
              margin: "0 auto 20px auto",
              display: "block",
            }}
          />
          <h2 style={{ color: "white", marginBottom: "1rem", whiteSpace: "pre-line" }}>
            {isArabic ? "أهلاً بعودتك\nيرجى تسجيل الدخول" : "Welcome Back\nKindly log in"}
          </h2>

          <input
            type="text"
            placeholder={isArabic ? "اسم المستخدم" : "User Name"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              padding: "10px",
              marginBottom: "1rem",
              borderRadius: "4px",
              border: "none",
            }}
          />

          <input
            type="password"
            placeholder={isArabic ? "كلمة المرور" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              padding: "10px",
              marginBottom: "0.5rem",
              borderRadius: "4px",
              border: "none",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              color: "white",
              fontSize: "0.9rem",
            }}
          >
            <label style={{ display: "flex", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ marginRight: "5px" }}
              />
              {isArabic ? "تذكرني" : "Remember me"}
            </label>
            <a href="#" style={{ color: "#f5a623", textDecoration: "none" }}>
              {isArabic ? "نسيت كلمة المرور؟" : "Forget Password?"}
            </a>
          </div>

          {errorMsg && <p style={{ color: "red", marginBottom: "1rem" }}>{errorMsg}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: loading ? "#999" : "#f5a623",
              color: "#000",
              padding: "10px",
              width: "100%",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading
              ? isArabic
                ? "جارٍ تسجيل الدخول..."
                : "Signing in..."
              : isArabic
              ? "تسجيل الدخول"
              : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
