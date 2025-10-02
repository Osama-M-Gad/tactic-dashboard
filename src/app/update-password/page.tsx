"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import AppHeader from "@/components/AppHeader";

type Phase = "verifying" | "ready" | "updating" | "done" | "error";

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

export default function UpdatePasswordPage() {
  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  // visibility toggles
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  // refs لمنع قفز التركيز
  const passRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLInputElement | null>(null);
  const focusedOnce = useRef(false);

  // اللغة من الهيدر
  const [isArabic, setIsArabic] = useState<boolean>(() =>
    typeof window !== "undefined" ? localStorage.getItem("lang") === "ar" : false
  );
  const toggleLang = () => setIsArabic(v => !v);

  // ركّز على أول حقل مرة واحدة عند الجاهزية
  useEffect(() => {
    if (phase === "ready" && !focusedOnce.current) {
      focusedOnce.current = true;
      passRef.current?.focus();
    }
  }, [phase]);

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
          width: 420,
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

  const InputWithEye = ({
    inputRef,
    value,
    onChange,
    placeholder,
    shown,
    setShown,
  }: {
    inputRef: React.RefObject<HTMLInputElement>;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    shown: boolean;
    setShown: (v: boolean) => void;
  }) => (
    <div style={{ position: "relative", width: "100%", marginBottom: 12 }}>
      <input
        ref={inputRef}
        type={shown ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        autoComplete="new-password"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
        style={{
          width: "100%",
          padding: "10px 44px 10px 12px",
          borderRadius: 8,
          border: "1px solid var(--input-border)",
          background: "var(--input-bg)",
          color: "var(--input-text)",
          outline: "none",
        }}
      />
      <button
        type="button"
        aria-label={shown ? (isArabic ? "إخفاء كلمة المرور" : "Hide password") : (isArabic ? "إظهار كلمة المرور" : "Show password")}
        title={shown ? (isArabic ? "إخفاء" : "Hide") : (isArabic ? "إظهار" : "Show")}
        onClick={() => {
          setShown(!shown);
          inputRef.current?.focus();
        }}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#f5a623")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
      >
        {shown ? <EyeOffIcon /> : <EyeIcon />}
      </button>
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

          {/* كلمة المرور + عين */}
          <InputWithEye
            inputRef={passRef}
            value={password}
            onChange={setPassword}
            placeholder={isArabic ? "كلمة المرور الجديدة" : "New password"}
            shown={show1}
            setShown={setShow1}
          />

          {/* تأكيد كلمة المرور + عين */}
          <InputWithEye
            inputRef={confirmRef}
            value={confirm}
            onChange={setConfirm}
            placeholder={isArabic ? "تأكيد كلمة المرور" : "Confirm new password"}
            shown={show2}
            setShown={setShow2}
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
