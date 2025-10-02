"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import AppHeader from "@/components/AppHeader";

type Phase = "verifying" | "ready" | "updating" | "done" | "error";

export default function UpdatePasswordPage() {
  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  // اللغة من الهيدر
  const [isArabic, setIsArabic] = useState<boolean>(() =>
    typeof window !== "undefined" ? localStorage.getItem("lang") === "ar" : false
  );
  const toggleLang = () => setIsArabic(v => !v);

  // التحقق من رابط Supabase وتثبيت الجلسة
  useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (!access_token || !refresh_token) throw new Error(isArabic ? "رابط غير صالح." : "Invalid reset link.");

        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;

        window.history.replaceState({}, "", url.origin + url.pathname);
        setPhase("ready");
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setMsg(message || (isArabic ? "الرابط غير صالح أو منتهي." : "Invalid or expired link."));
        setPhase("error");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (): string | null => {
    if (password.length < 6)
      return isArabic ? "يجب أن تكون كلمة المرور 6 أحرف على الأقل." : "Password must be at least 6 characters.";
    if (/\s/.test(password))
      return isArabic ? "لا يمكن أن تحتوي كلمة المرور على مسافات." : "Password cannot contain spaces.";
    if (password !== confirm)
      return isArabic ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.";
    return null;
  };

  const handleUpdate = async () => {
    setMsg("");
    const err = validate();
    if (err) return setMsg(err);

    setPhase("updating");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg(error.message);
      setPhase("ready");
    } else {
      setPhase("done");
    }
  };

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div style={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", padding: 24 }}>
      <div
        style={{
          width: 380,
          background: "var(--card)",
          color: "var(--text)",
          padding: 20,
          borderRadius: 12,
          boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
          border: "1px solid var(--divider)",
        }}
      >
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <AppHeader isArabic={isArabic} onToggleLang={toggleLang} showLogout={false} className="app-header" />

      {phase === "verifying" && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Tactic Portal</h3>
          <p>{isArabic ? "جارٍ التحقق من رابط إعادة التعيين…" : "Verifying your reset link…"}</p>
        </Card>
      )}

      {phase === "error" && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Tactic Portal</h3>
          <p style={{ color: "#ff6b6b", marginBottom: 8 }}>
            {msg || (isArabic ? "رابط غير صالح." : "Invalid link.")}
          </p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 0, direction: isArabic ? "rtl" : "ltr", textAlign: isArabic ? "right" : "left" }}>
            {isArabic ? "جرّب طلب رابط إعادة تعيين جديد من صفحة تسجيل الدخول." : "Try requesting a new reset link from the login page."}
          </p>
        </Card>
      )}

      {phase === "done" && (
        <Card>
          <h3 style={{ marginTop: 0 }}>{isArabic ? "تم تحديث كلمة المرور" : "Password updated"}</h3>
          <p>{isArabic ? "يمكنك إغلاق هذه الصفحة وتسجيل الدخول إلى Tactic Portal." : "You can close this tab and log in to Tactic Portal."}</p>
        </Card>
      )}

      {(phase === "ready" || phase === "updating") && (
        <Card>
          <h3 style={{ marginTop: 0 }}>{isArabic ? "تعيين كلمة مرور جديدة" : "Set a new password"}</h3>

          {/* كلمة المرور */}
          <input
            type="password"
            placeholder={isArabic ? "كلمة المرور الجديدة" : "New password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleUpdate()}
            style={{
              width: "100%",
              padding: 10,
              margin: "10px 0",
              borderRadius: 8,
              border: "1px solid var(--input-border)",
              background: "var(--input-bg)",
              color: "var(--input-text)",
            }}
            autoFocus
          />

          {/* تأكيد كلمة المرور */}
          <input
            type="password"
            placeholder={isArabic ? "تأكيد كلمة المرور" : "Confirm new password"}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleUpdate()}
            style={{
              width: "100%",
              padding: 10,
              margin: "6px 0 12px",
              borderRadius: 8,
              border: "1px solid var(--input-border)",
              background: "var(--input-bg)",
              color: "var(--input-text)",
            }}
          />

          {msg && <p style={{ color: "#ff6b6b", marginTop: 0 }}>{msg}</p>}

          <button
            onClick={handleUpdate}
            disabled={phase === "updating"}
            style={{
              width: "100%",
              padding: 12,
              border: "none",
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              borderRadius: 10,
              fontWeight: 800,
              cursor: "pointer",
              opacity: phase === "updating" ? 0.7 : 1,
            }}
          >
            {phase === "updating" ? (isArabic ? "جارٍ التحديث…" : "Updating…") : (isArabic ? "تحديث" : "Update")}
          </button>

          <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid var(--divider)" }} />

          <div style={{ fontSize: 12, color: "var(--muted)", direction: isArabic ? "rtl" : "ltr", textAlign: isArabic ? "right" : "left" }}>
            <strong>Tactic Portal</strong>
            <br />
            {isArabic ? "إذا لم تطلب ذلك، يمكنك تجاهل هذه الصفحة بأمان." : "If you didn’t request this, you can safely ignore this page."}
          </div>
        </Card>
      )}
    </div>
  );
}
