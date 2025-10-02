"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import Image from "next/image";

/* ===== Types ===== */
type PortalUser = {
  id: string;
  role: string;
  username?: string;
  email?: string;
  auth_user_id?: string;
  [key: string]: unknown;
};

/* ===== Icons ===== */
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
  const [isDark, setIsDark] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // ===== Reset Password Modal =====
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const toggleLanguage = () => setIsArabic((s: boolean) => !s);
  const toggleTheme = () =>
    setIsDark((prev) => {
      const next = !prev;
      try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
      return next;
    });

  const TEXT = { wrong: isArabic ? "البيانات غلط" : "Invalid username or password" };

  function getStoredUser(): PortalUser | null {
    try {
      const ls = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
      if (ls) return JSON.parse(ls) as PortalUser;
      const ss = typeof window !== "undefined" ? sessionStorage.getItem("currentUser") : null;
      if (ss) return JSON.parse(ss) as PortalUser;
      return null;
    } catch { return null; }
  }
  function routeByRole(user: PortalUser) {
    const role = String(user?.role || "").toLowerCase();
    if (role === "super_admin") router.replace("/super-admin/dashboard");
    else if (role === "admin") router.replace("/admin/dashboard");
  }

  // Prefill username/remember + Theme
  useEffect(() => {
    try {
      const remembered = localStorage.getItem("rememberedUsername");
      const rememberFlag = localStorage.getItem("rememberMe") === "1";
      const savedTheme = localStorage.getItem("theme");
      if (remembered) setUsername(remembered);
      setRememberMe(rememberFlag);
      if (savedTheme) setIsDark(savedTheme === "dark");
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
      const { data, error } = await supabase
        .from("Users")
        .select("*")
        .eq("username", username.trim())
        .eq("password", password)
        .single();

      if (error || !data) { setErrorMsg(TEXT.wrong); return; }

      const user = data as PortalUser;
      const role = String(user.role || "").toLowerCase();
      const isSuper = role === "super_admin";
      const isAdmin = role === "admin";
      if (!isSuper && !isAdmin) { setErrorMsg(TEXT.wrong); return; }

      /* ===== Auto-link with Supabase Auth via RPC ===== */
try {
  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  console.log("[AUTH-LINK] using email:", email); // 🔍

  if (email) {
    // 1) Sign In
    const { data: sIn, error: sInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("[AUTH-LINK] signIn error:", sInErr);
    console.log("[AUTH-LINK] signIn user:", sIn?.user?.id);

    if (sIn?.user && !sInErr) {
      const { error: rpcErr } = await supabase.rpc("link_auth_user", {
        p_user_id: user.id,
        p_auth_user_id: sIn.user.id,
      });
      console.log("[AUTH-LINK] rpc (sign-in) error:", rpcErr);
    } else {
      // 2) Sign Up
      const { data: sUp, error: sUpErr } = await supabase.auth.signUp({ email, password });
      console.log("[AUTH-LINK] signUp error:", sUpErr);
      console.log("[AUTH-LINK] signUp user:", sUp?.user?.id);

      if (sUp?.user && !sUpErr) {
        const { error: rpcErr2 } = await supabase.rpc("link_auth_user", {
          p_user_id: user.id,
          p_auth_user_id: sUp.user.id,
        });
        console.log("[AUTH-LINK] rpc (sign-up) error:", rpcErr2);
      } else if (sUpErr && /already registered|User already registered/i.test(sUpErr.message)) {
        console.warn("[AUTH-LINK] email exists with different password → ask for reset");
      }
    }
  } else {
    console.warn("[AUTH-LINK] user has NO email in Users table — skipping auth link.");
  }
} catch (linkErr) {
  console.warn("[AUTH-LINK] unexpected error:", linkErr);
}
/* ===== End auto-link ===== */

      // Save session locally + record user_sessions
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("currentUser", JSON.stringify(user));
      storage.setItem("rememberMe", rememberMe ? "1" : "0");

      const sessionKey = crypto.randomUUID();
      await supabase.from("user_sessions").insert({
        user_id: user.id,
        session_key: sessionKey,
        platform: "web",
        app_version: "portal-v1",
      });
      storage.setItem("session_key", sessionKey);

      if (rememberMe) { try { localStorage.setItem("rememberedUsername", username.trim()); } catch {} }

      const target = isSuper ? "/super-admin/dashboard" : "/admin/dashboard";
      router.push(target);
      setTimeout(() => { try { window.location.reload(); } catch {} }, 150);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setResetMsg("");
    const email = resetEmail.trim();

    // تحقق من صيغة الإيميل
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      setResetMsg(isArabic ? "صيغة البريد غير صحيحة" : "Invalid email format");
      return;
    }

    setResetLoading(true);
    try {
      // تأكد أن الإيميل موجود ومربوط بـ auth_user_id
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
      if (error) {
        setResetMsg(error.message);
      } else {
        setResetMsg(isArabic ? "تم إرسال رابط إعادة التعيين إلى بريدك" : "Password reset link sent");
      }
    } catch (err: unknown) {
      setResetMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setResetLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") handleLogin(); };
  const LOGO = "https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files/logo.png";

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
          backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)",
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
          unoptimized
        />

        <div style={{ display: "flex", gap: "10px" }}>
          <a
            href="https://www.tai.com.sa"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              backgroundColor: "#f5a623", color: "#000", padding: "8px 12px",
              borderRadius: "4px", textDecoration: "none", fontWeight: "bold", fontSize: "0.9rem",
            }}
          >
            {isArabic ? "الموقع التعريفي" : "Company Site"}
          </a>

          <button
            onClick={toggleTheme}
            style={{
              backgroundColor: "#f5a623", color: "#000", padding: "8px 12px",
              border: "none", borderRadius: "4px", fontWeight: "bold", fontSize: "0.9rem", cursor: "pointer",
            }}
          >
            {isDark ? (isArabic ? "وضع فاتح" : "Light") : (isArabic ? "وضع داكن" : "Dark")}
          </button>

          <button
            onClick={toggleLanguage}
            style={{
              backgroundColor: "#f5a623", color: "#000", padding: "8px 12px",
              border: "none", borderRadius: "4px", fontWeight: "bold", fontSize: "0.9rem", cursor: "pointer",
            }}
          >
            {isArabic ? "EN" : "AR"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          minHeight: "calc(100vh - 60px)",
        }}
      >
        <div
          style={{
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(255,255,255,0.9)",
            padding: "2rem", borderRadius: "8px", width: "350px", textAlign: "center",
            color: isDark ? "#fff" : "#000",
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

          <h2 style={{ marginBottom: "1rem", whiteSpace: "pre-line" }}>
            {isArabic ? "أهلاً بعودتك\nيرجى تسجيل الدخول" : "Welcome Back\nKindly log in"}
          </h2>

          {/* Username */}
          <input
            type="text"
            placeholder={isArabic ? "اسم المستخدم" : "User Name"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={onKeyDown}
            style={{
              display: "block", width: "100%", padding: "10px", marginBottom: "1rem",
              borderRadius: "6px",
              border: isDark ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(0,0,0,0.15)",
              background: isDark ? "rgba(255,255,255,0.08)" : "#fff",
              color: isDark ? "#fff" : "#111", outline: "none",
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
                display: "block", width: "100%", padding: "10px 44px 10px 12px",
                borderRadius: "6px",
                border: isDark ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(0,0,0,0.15)",
                background: isDark ? "rgba(255,255,255,0.08)" : "#fff",
                color: isDark ? "#fff" : "#111", outline: "none",
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
                position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                border: "none", background: "transparent", cursor: "pointer", padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
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
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "1rem", fontSize: "0.9rem",
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
            <a
              href="#"
              onClick={() => setShowResetModal(true)}
              style={{ color: "#f5a623", textDecoration: "none" }}
            >
              {isArabic ? "نسيت كلمة المرور؟" : "Forget Password?"}
            </a>
          </div>

          {errorMsg && <p style={{ color: "red", marginBottom: "1rem" }}>{errorMsg}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: "#f5a623", color: "#000", padding: "10px", width: "100%",
              border: "none", borderRadius: "4px", fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (isArabic ? "جارٍ تسجيل الدخول..." : "Signing in...") :
              (isArabic ? "تسجيل الدخول" : "Sign in")}
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
                  color: resetMsg.includes("sent") || resetMsg.includes("تم")
                    ? "#22c55e" // success
                    : "#ef4444", // error
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
                  background: "#f5a623", // Send
                  color: "#000",
                  border: "none",
                  padding: "10px 0",
                  borderRadius: 6,
                  fontWeight: "bold",
                  cursor: resetLoading ? "not-allowed" : "pointer",
                  opacity: resetLoading ? 0.6 : 1,
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
                  background: "#ef4444", // Cancel
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
