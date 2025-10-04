"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/utils/supabaseClient";
import { useLangTheme } from "@/hooks/useLangTheme";


/* ===== Types ===== */
type PortalUser = {
  id: string;
  role: string;
  username?: string;
  email?: string;
  auth_user_id?: string;
  password?: string | null;
  [key: string]: unknown;
};

/* ===== Icons ===== */
const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" {...props}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);
const EyeOffIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" {...props}>
    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" />
    <path d="M10.58 5.08A11.5 11.5 0 0 1 12 5c6.5 0 10 6 10 6a18.6 18.6 0 0 1-4.11 4.59M6.11 8.41A18.6 18.6 0 0 0 2 11s3.5 6 10 6c1.13 0 2.2-.18 3.2-.5" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const { isArabic, isDark } = useLangTheme(); // ← جاي من الهوك الجديد

  const [mounted, setMounted] = useState(false); // لمنع Hydration mismatch في النص الحساس
  useEffect(() => setMounted(true), []);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset Password Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const TEXT = useMemo(
    () => ({
      wrong: isArabic ? "بيانات غير صحيحة" : "Invalid username or password",
      forbidden: isArabic ? "غير مسموح لك باستخدام البوابة" : "You are not allowed to use this portal",
    }),
    [isArabic]
  );

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

  // Prefill username/remember
  useEffect(() => {
    try {
      const remembered = localStorage.getItem("rememberedUsername");
      const rememberFlag = localStorage.getItem("rememberMe") === "1";
      if (remembered) setUsername(remembered);
      setRememberMe(rememberFlag);
    } catch {}
  }, []);

  // Auto-redirect + optional one-time refresh if Remember Me
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      routeByRole(stored);
      try {
        const rememberFlag = localStorage.getItem("rememberMe") === "1";
        const didAutoRefresh = sessionStorage.getItem("did_auto_refresh") === "1";
        if (rememberFlag && !didAutoRefresh) {
          setTimeout(() => {
            sessionStorage.setItem("did_auto_refresh", "1");
            window.location.reload();
          }, 300);
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync remember
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
      const { data: user, error: uErr } = await supabase
        .from("Users")
        .select("id, role, username, email, auth_user_id, password")
        .eq("username", username.trim())
        .maybeSingle();

      if (uErr || !user) {
        setErrorMsg(TEXT.wrong);
        return;
      }

      const role = String(user.role || "").toLowerCase();
      const isSuper = role === "super_admin";
      const isAdmin = role === "admin";
      if (!isSuper && !isAdmin) {
        setErrorMsg(TEXT.forbidden);
        return;
      }

      const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
      let signedIn = false;
      let authUserId: string | null = null;

      if (user.auth_user_id && email) {
        const { data: sIn, error: sInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (!sInErr && sIn?.user) {
          signedIn = true;
          authUserId = sIn.user.id;
        } else {
          setErrorMsg(TEXT.wrong);
          return;
        }
      } else {
        const tablePwd = typeof user.password === "string" ? user.password : "";
        if (tablePwd && password && tablePwd === password) {
          signedIn = true;

          if (email) {
            try {
              const { data: sIn2, error: sInErr2 } = await supabase.auth.signInWithPassword({ email, password });
              if (sIn2?.user && !sInErr2) authUserId = sIn2.user.id;
              else {
                const { data: sUp, error: sUpErr } = await supabase.auth.signUp({ email, password });
                if (sUp?.user && !sUpErr) authUserId = sUp.user.id;
              }

              if (authUserId) {
                const { error: rpcErr } = await supabase.rpc("link_auth_user", {
                  p_user_id: user.id,
                  p_auth_user_id: authUserId,
                });
                if (rpcErr) console.warn("[AUTH-LINK] rpc error:", rpcErr);
              }
            } catch (linkErr) {
              console.warn("[AUTH-LINK] unexpected:", linkErr);
            }
          }
        } else {
          setErrorMsg(TEXT.wrong);
          return;
        }
      }

      if (!signedIn) {
        setErrorMsg(TEXT.wrong);
        return;
      }

      const safeUser: PortalUser = {
        id: user.id,
        role: user.role,
        username: user.username,
        email: user.email,
        auth_user_id: user.auth_user_id || authUserId || undefined,
      };

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("currentUser", JSON.stringify(safeUser));
      storage.setItem("rememberMe", rememberMe ? "1" : "0");

      const sessionKey = crypto.randomUUID();
      await supabase.from("user_sessions").insert({
        user_id: user.id,
        session_key: sessionKey,
        platform: "web",
        app_version: "portal-v1",
      });
      storage.setItem("session_key", sessionKey);

      if (rememberMe) {
        try {
          localStorage.setItem("rememberedUsername", username.trim());
        } catch {}
      }

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

  const handleResetPassword = async () => {
    setResetMsg("");
    const email = resetEmail.trim();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      setResetMsg(isArabic ? "صيغة البريد غير صحيحة" : "Invalid email format");
      return;
    }

    setResetLoading(true);
    try {
      const { data: u, error: uErr } = await supabase
        .from("Users")
        .select("id, auth_user_id")
        .eq("email", email)
        .maybeSingle();

      if (uErr || !u || !u.auth_user_id) {
        setResetMsg(isArabic ? "البريد غير مسجّل" : "Email not found");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/update-password",
      });
      if (error) setResetMsg(error.message);
      else setResetMsg(isArabic ? "تم إرسال رابط إعادة التعيين إلى بريدك" : "Password reset link sent");
    } catch (err: unknown) {
      setResetMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setResetLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleLogin();
  };

  const LOGO =
    "https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files/logo.png";

  return (
  <div style={{ minHeight: "100dvh", position: "relative" }}>
    {/* خلفية ملء الشاشة */}
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        backgroundImage:
          "url('https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files/bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        zIndex: 0,
        transform: "translateZ(0)",
      }}
    />
    {/* طبقة تعتيم حسب الثيم */}
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        background: isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.25)",
        backdropFilter: "blur(1px)",
      }}
    />

    {/* Body */}
    <div
      style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100dvh",
        padding: "24px 12px",
      }}
    >
      <div
        style={{
          backgroundColor: isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(255,255,255,0.9)",
          padding: "2rem",
          borderRadius: "8px",
          width: "min(350px, 92vw)",
          textAlign: "center",
          color: isDark ? "#fff" : "#000",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        }}
      >
        <Image
          src={LOGO}
          alt="Tactic Logo"
          width={200}
          height={80}
          style={{ width: "200px", margin: "0 auto 20px auto", display: "block" }}
          unoptimized
        />

        <h2 style={{ marginBottom: "1rem", whiteSpace: "pre-line" }} suppressHydrationWarning>
          {mounted
            ? (isArabic ? "أهلاً بعودتك\nيرجى تسجيل الدخول" : "Welcome Back\nKindly log in")
            : "Welcome Back\nKindly log in"}
        </h2>

        {/* Username */}
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
            borderRadius: "6px",
            border: isDark ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(0,0,0,0.15)",
            background: isDark ? "rgba(255,255,255,0.08)" : "#fff",
            color: isDark ? "#fff" : "#111",
            outline: "none",
          }}
          autoComplete="username"
        />

        {/* Password + Eye */}
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
              border: isDark ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(0,0,0,0.15)",
              background: isDark ? "rgba(255,255,255,0.08)" : "#fff",
              color: isDark ? "#fff" : "#111",
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
              color: isDark ? "#d1d5db" : "#666",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f5a623")}
            onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? "#d1d5db" : "#666")}
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
            fontSize: "0.9rem",
            color: isDark ? "#fff" : "#000",
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
          <a href="#" onClick={() => setShowResetModal(true)} style={{ color: "#f5a623", textDecoration: "none" }}>
            {isArabic ? "نسيت كلمة المرور؟" : "Forget Password?"}
          </a>
        </div>

        {errorMsg && <p style={{ color: "red", marginBottom: "1rem" }}>{errorMsg}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            backgroundColor: "#f5a623",
            color: "#000",
            padding: "10px",
            width: "100%",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (isArabic ? "جارٍ تسجيل الدخول..." : "Signing in...") : (isArabic ? "تسجيل الدخول" : "Sign in")}
        </button>
      </div>
    </div>

    {/* Reset Password Modal */}
    {showResetModal && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 50,
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            background: "#111",
            color: "#fff",
            padding: 20,
            borderRadius: 8,
            width: 360,
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
            textAlign: "center",
          }}
        >
          <h3 style={{ marginBottom: 12 }}>
            {isArabic ? "إعادة تعيين كلمة المرور" : "Reset Password"}
          </h3>

          <input
            type="email"
            placeholder={isArabic ? "أدخل بريدك" : "Enter your email"}
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              margin: "10px 0 6px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              outline: "none",
            }}
          />

          {resetMsg && (
            <p
              style={{
                margin: "6px 0 10px",
                fontSize: "0.9rem",
                color: resetMsg.includes("sent") || resetMsg.includes("تم") ? "#22c55e" : "#ef4444",
              }}
            >
              {resetMsg}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              onClick={handleResetPassword}
              disabled={resetLoading}
              style={{
                flex: 1,
                background: "#f5a623",
                color: "#000",
                border: "none",
                padding: "10px 0",
                borderRadius: 6,
                fontWeight: "bold",
              }}
            >
              {resetLoading ? (isArabic ? "جارٍ الإرسال..." : "Sending...") : (isArabic ? "إرسال" : "Send")}
            </button>

            <button
              onClick={() => {
                setShowResetModal(false);
                setResetEmail("");
                setResetMsg("");
              }}
              style={{
                flex: 1,
                background: "#ef4444",
                color: "#fff",
                border: "none",
                padding: "10px 0",
                borderRadius: 6,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {isArabic ? "إلغاء" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
