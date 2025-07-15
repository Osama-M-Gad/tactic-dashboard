"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function LoginPage() {
  const [isArabic, setIsArabic] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const toggleLanguage = () => {
    setIsArabic(!isArabic);
  };

  const handleLogin = async () => {
    setErrorMsg("");

    const { data, error } = await supabase
      .from("Users")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error || !data) {
      setErrorMsg(isArabic ? "خطأ في اسم المستخدم أو كلمة المرور" : "Invalid username or password");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div
      style={{
        backgroundImage: "url('https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files//bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
      }}
    >
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
          <h2 style={{ color: "white", marginBottom: "1rem" }}>
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
              <input type="checkbox" style={{ marginRight: "5px" }} />
              {isArabic ? "تذكرني" : "Remember me"}
            </label>
            <a href="#" style={{ color: "#f5a623", textDecoration: "none" }}>
              {isArabic ? "نسيت كلمة المرور؟" : "Forget Password?"}
            </a>
          </div>

          {errorMsg && (
            <p style={{ color: "red", marginBottom: "1rem" }}>{errorMsg}</p>
          )}

          <button
            onClick={handleLogin}
            style={{
              backgroundColor: "#f5a623",
              color: "#000",
              padding: "10px",
              width: "100%",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {isArabic ? "تسجيل الدخول" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
