"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import AppHeader from "@/components/AppHeader";

type Phase = "verifying" | "ready" | "updating" | "done" | "error";

export default function RecoveryPage() {
  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [isArabic, setIsArabic] = useState<boolean>(() =>
    typeof window !== "undefined" ? localStorage.getItem("lang") === "ar" : false
  );
  const toggleLang = () => setIsArabic(v => !v);

  const containsArabic = (s: string) =>
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669\u06F0-\u06F9]/.test(s);

  useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (!access_token || !refresh_token) throw new Error("Invalid reset link. No tokens found.");

        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;

        window.history.replaceState({}, "", url.origin + url.pathname);
        setPhase("ready");
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setMsg(message || "Invalid or expired link.");
        setPhase("error");
      }
    };
    run();
  }, []);

  const validate = (): string | null => {
    if (password.length < 8) return "Password must be at least 8 characters. | يجب أن تكون كلمة المرور 8 أحرف على الأقل.";
    if (/\s/.test(password)) return "Password cannot contain spaces. | لا يمكن أن تحتوي كلمة المرور على مسافات.";
    if (containsArabic(password)) return "Password must use Latin letters/numbers only. | كلمة المرور يجب أن تكون بأحرف/أرقام لاتينية فقط.";
    if (password !== confirm) return "Passwords do not match. | كلمتا المرور غير متطابقتين.";
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
    <div style={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", padding: "24px" }}>
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
      <AppHeader isArabic={isArabic} onToggleLang={toggleLang} showLogout={false} />

      {phase === "verifying" && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Tactic Portal</h3>
          <p>Verifying your reset link…</p>
        </Card>
      )}

      {phase === "error" && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Tactic Portal</h3>
          <p style={{ color: "#ff6b6b", marginBottom: 8 }}>{msg || "Invalid link."}</p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 0 }}>
            Try requesting a new reset link from the login page.
          </p>
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--divider)" }} />
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 0, direction: "rtl", textAlign: "right" }}>
            جرّب طلب رابط إعادة تعيين جديد من صفحة تسجيل الدخول.
          </p>
        </Card>
      )}

      {phase === "done" && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Password updated</h3>
          <p>You can close this tab and log in to Tactic Portal.</p>
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--divider)" }} />
          <h3 style={{ marginTop: 0, direction: "rtl", textAlign: "right" }}>تم تحديث كلمة المرور</h3>
          <p style={{ direction: "rtl", textAlign: "right" }}>يمكنك إغلاق هذه الصفحة وتسجيل الدخول إلى Tactic Portal.</p>
        </Card>
      )}

      {(phase === "ready" || phase === "updating") && (
        <Card>
          <h3 style={{ marginTop: 0 }}>{isArabic ? "تعيين كلمة مرور جديدة" : "Set a new password"}</h3>

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
              border: "1px solid var(--divider)",
              background: "transparent",
              color: "var(--text)",
            }}
            autoFocus
          />

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
              border: "1px solid var(--divider)",
              background: "transparent",
              color: "var(--text)",
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

          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            <strong>Tactic Portal</strong>
            <br />
            If you didn’t request this, you can safely ignore this page.
          </div>

          <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid var(--divider)" }} />

          <div style={{ fontSize: 12, color: "var(--muted)", direction: "rtl", textAlign: "right" }}>
            <strong>منصة Tactic Portal</strong>
            <br />
            إذا لم تطلب ذلك، يمكنك تجاهل هذه الصفحة بأمان.
          </div>
        </Card>
      )}
    </div>
  );
}
