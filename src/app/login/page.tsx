"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import Image from "next/image";

type PortalUser = {
  id: string;
  role: string;
  username?: string;
  [key: string]: unknown;
};

// SVG Icons للعين
const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" {...props}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
);

const EyeOffIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" {...props}>
    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M10.58 5.08A11.5 11.5 0 0 1 12 5c6.5 0 10 6 10 6a18.6 18.6 0 0 1-4.11 4.59M6.11 8.41A18.6 18.6 0 0 0 2 11s3.5 6 10 6c1.13 0 2.2-.18 3.2-.5" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
);

export default function LoginPage() {
  const [isArabic, setIsArabic] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const toggleLanguage = () => setIsArabic((s: boolean) => !s);

  const TEXT = {
    wrong: isArabic ? "البيانات غلط" : "Invalid username or password",
  };

  function getStoredUser(): PortalUser | null {
    try {
      const ls = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
      if (ls) return JSON.parse(ls) as PortalUser;
      const ss = typeof window !== "undefined" ? sessionStorage.getItem("currentUser") : null;
      if (ss) return JSON.parse(ss) as PortalUser;
      return null;
    } catch {
      return null;
    }
  }

  function routeByRole(user: PortalUser) {
    const role = String(user?.role || "").toLowerCase();
    if (role === "super_admin") router.replace("/super-admin/dashboard");
    else if (role === "admin") router.replace("/admin/dashboard");
  }

  // Prefill username & rememberMe
  useEffect(() => {
    try {
      const remembered = localStorage.getItem("rememberedUsername");
      const rememberFlag = localStorage.getItem("rememberMe") === "1";
      if (remembered) setUsername(remembered);
      setRememberMe(rememberFlag);
    } catch {}
  }, []);

  // Auto-redirect if already signed in
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) routeByRole(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync rememberMe + username to storage (username only, no passwords)
  useEffect(() => {
    try {
      if (rememberMe && username.trim()) {
        localStorage.setItem("rememberedUsername", username.trim());
        localStorage.setItem("rememberMe", "1");
      } else {
        localStorage.removeItem("rememberedUsername");
        localStorage.setItem("rememberMe", "0");
      }
    } catch {}
  }, [rememberMe, username]);

  const handleLogin = async () => {
    setErrorMsg("");
    setLoading(true);

    try {
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

      const user = data as unknown as PortalUser;
      const role = String(user.role || "").toLowerCase();
      const isSuper = role === "super_admin";
      const isAdmin = role === "admin";
      if (!isSuper && !isAdmin) {
        setErrorMsg(TEXT.wrong);
        return;
      }

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("currentUser", JSON.stringify(user));
      storage.setItem("rememberMe", rememberMe ? "1" : "0");

      // record session
      const sessionKey = crypto.randomUUID();
      await supabase.from("user_sessions").insert({
        user_id: user.id,
        session_key: sessionKey,
        platform: "web",
        app_version: "portal-v1",
      });
      storage.setItem("session_key", sessionKey);

      // persist username for next time if rememberMe
      if (rememberMe) {
        try {
          localStorage.setItem("rememberedUsername", username.trim());
        } catch {}
      }

      // Navigate then hard refresh to fetch everything fresh
      const target = isSuper ? "/super-admin/dashboard" : "/admin/dashboard";
      router.push(target);
      setTimeout(() => {
        try {
          window.location.reload();
        } catch {}
      }, 150);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleLogin();
  };

  const LOGO =
    "https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files/logo.png";

  return (
    <div
      style={{
        backgroundImage:
          "url('https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files/bg.jpg')",
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
        <Image
          src={LOGO}
          alt="Tactic Logo"
          width={200}
          height={75}
          style={{ height: "75px", width: "auto" }}
          priority
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
          <Image
            src={LOGO}
            alt="Tactic Logo"
            width={200}
            height={80}
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
            onKeyDown={onKeyDown}
            style={{
              display: "block",
              width: "100%",
              padding: "10px",
              marginBottom: "1rem",
              borderRadius: "4px",
              border: "none",
            }}
            autoComplete="username"
          />

          {/* Password with eye toggle */}
          <div style={{ position: "relative", width: "100%", marginBottom: "0.5rem" }}>
            <input
              ref={passwordInputRef}
              type={showPassword ? "text" : "password"}
              placeholder={isArabic ? "كلمة المرور" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 44px 10px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                outline: "none",
              }}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => {
                setShowPassword((s: boolean) => !s);
                passwordInputRef.current?.focus();
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? (isArabic ? "إخفاء" : "Hide") : (isArabic ? "إظهار" : "Show")}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#d1d5db",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f5a623")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#d1d5db")}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

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
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
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
