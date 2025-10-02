"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function RecoveryPage() {
  type Phase = "verifying" | "ready" | "updating" | "done" | "error";
  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  // مانع الأحرف العربية + الأرقام العربية
  const containsArabic = (s: string) =>
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669\u06F0-\u06F9]/.test(s);

  useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");

        if (!access_token || !refresh_token) {
          throw new Error("Invalid reset link. No tokens found.");
        }

        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) throw error;

        // نظّف الهاش من الـ URL
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
    if (password.length < 8) {
      return "Password must be at least 8 characters. | يجب أن تكون كلمة المرور 8 أحرف على الأقل.";
    }
    if (/\s/.test(password)) {
      return "Password cannot contain spaces. | لا يمكن أن تحتوي كلمة المرور على مسافات.";
    }
    if (containsArabic(password)) {
      return "Password must use Latin letters/numbers only. | كلمة المرور يجب أن تكون بأحرف/أرقام لاتينية فقط.";
    }
    if (password !== confirm) {
      return "Passwords do not match. | كلمتا المرور غير متطابقتين.";
    }
    return null;
  };

  const handleUpdate = async () => {
    setMsg("");
    const err = validate();
    if (err) {
      setMsg(err);
      return;
    }
    setPhase("updating");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg(`${error.message}`);
      setPhase("ready");
    } else {
      setPhase("done");
    }
  };

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f7fb" }}>
      <div
        style={{
          width: 360,
          background: "#fff",
          padding: 20,
          borderRadius: 10,
          boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
        }}
      >
        {children}
      </div>
    </div>
  );

  if (phase === "verifying") {
    return (
      <Card>
        <h3 style={{ marginTop: 0 }}>Tactic Portal</h3>
        <p>Verifying your reset link…</p>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card>
        <h3 style={{ marginTop: 0 }}>Tactic Portal</h3>
        <p style={{ color: "red", marginBottom: 8 }}>{msg || "Invalid link."}</p>
        <p style={{ fontSize: 12, color: "#555", marginTop: 0 }}>
          Try requesting a new reset link from the login page.
        </p>
        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eee" }} />
        <p style={{ fontSize: 12, color: "#555", marginTop: 0, direction: "rtl", textAlign: "right" }}>
          جرّب طلب رابط إعادة تعيين جديد من صفحة تسجيل الدخول.
        </p>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card>
        <h3 style={{ marginTop: 0 }}>Password updated</h3>
        <p>You can close this tab and log in to Tactic Portal.</p>

        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eee" }} />

        <h3 style={{ marginTop: 0, direction: "rtl", textAlign: "right" }}>تم تحديث كلمة المرور</h3>
        <p style={{ direction: "rtl", textAlign: "right" }}>
          يمكنك إغلاق هذه الصفحة وتسجيل الدخول إلى Tactic Portal.
        </p>
      </Card>
    );
  }

  // phase === "ready"
  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Set a new password</h3>

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
        style={{ width: "100%", padding: 10, margin: "10px 0", borderRadius: 6, border: "1px solid #ddd" }}
        autoFocus
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
        style={{ width: "100%", padding: 10, margin: "6px 0 12px", borderRadius: 6, border: "1px solid #ddd" }}
      />

      {msg && (
        <p style={{ color: "red", marginTop: 0 }}>
          {msg}
        </p>
      )}

      <button
        onClick={handleUpdate}
        disabled={phase === "updating"}
        style={{
          width: "100%",
          padding: 12,
          border: "none",
          background: "#F5A623",
          color: "#000",
          borderRadius: 8,
          fontWeight: 700,
          cursor: "pointer",
          opacity: phase === "updating" ? 0.7 : 1,
        }}
      >
        {phase === "updating" ? "Updating…" : "Update"}
      </button>

      <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid #eee" }} />

      <div style={{ fontSize: 12, color: "#666" }}>
        <strong>Tactic Portal</strong>
        <br />
        If you didn’t request this, you can safely ignore this page.
      </div>

      <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid #eee" }} />

      <div style={{ fontSize: 12, color: "#666", direction: "rtl", textAlign: "right" }}>
        <strong>منصة Tactic Portal</strong>
        <br />
        إذا لم تطلب ذلك، يمكنك تجاهل هذه الصفحة بأمان.
      </div>
    </Card>
  );
}
