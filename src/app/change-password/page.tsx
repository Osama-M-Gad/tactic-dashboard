// app/change-password/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useLangTheme } from "@/hooks/useLangTheme";
import { useToast } from "@/components/ui/Toast";
import PopupDialog from "@/components/ui/PopupDialog";

type Stage = "idle" | "checking" | "updating" | "confirmLogout" | "error";
const MIN_LEN = 6;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

/* i18n */
const tr = (ar: boolean) => ({
  title: ar ? "تغيير كلمة المرور" : "Change Password",
  accountLabel: ar ? "الحساب:" : "Account:",
  loadingAcct: ar ? "جاري جلب بيانات الحساب…" : "Loading account…",
  current: ar ? "كلمة المرور الحالية" : "Current password",
  currentPh: ar ? "ادخل كلمة المرور الحالية" : "Enter your current password",
  new: ar ? "كلمة المرور الجديدة" : "New password",
  newPh: ar ? `${MIN_LEN}+ أحرف` : `${MIN_LEN}+ characters`,
  confirm: ar ? "تأكيد كلمة المرور الجديدة" : "Confirm new password",
  confirmPh: ar ? "أعد كتابة الكلمة الجديدة" : "Re-enter the new password",
  note: ar
    ? `يجب أن تكون ${MIN_LEN} أحرف على الأقل — يُسمح بحروف أو أرقام أو علامات.`
    : `At least ${MIN_LEN} characters — letters, numbers, or symbols are allowed.`,
  save: ar ? "حفظ كلمة المرور" : "Save password",
  saving: ar ? "جارٍ التحديث…" : "Updating…",
  back: ar ? "رجوع" : "Back",
  wrongCurrent: ar ? "كلمة المرور الحالية غير صحيحة." : "Current password is incorrect.",
  genericErr: ar ? "حدث خطأ غير متوقع." : "An unexpected error occurred.",
  okUpdated: ar ? "تم تغيير كلمة المرور بنجاح." : "Password updated successfully.",
  askLogout: ar ? "هل تريد تسجيل الخروج من جميع الأجهزة؟" : "Do you want to sign out from all devices?",
  yesLogoutAll: ar ? "نعم، تسجيل الخروج الكلي" : "Yes, sign out everywhere",
  stayLogged: ar ? "لا، البقاء في الجلسة الحالية" : "No, stay signed in",
  forgot: ar ? "نسيت كلمة المرور؟" : "Forgot password?",
  sendingLink: ar ? "يتم إرسال الرابط…" : "Sending link…",
  cannotSend: ar ? "لا يمكن إرسال رابط الاستعادة: لا يوجد إيميل مرتبط بالحساب." : "Cannot send recovery link: no email linked to this account.",
  validateNoAcct: ar ? "لم يتم التعرف على الحساب." : "Account not recognized.",
  validateEnterCurr: ar ? "أدخل كلمة المرور الحالية." : "Enter your current password.",
  validateEnterNew: ar ? "أدخل كلمة المرور الجديدة." : "Enter your new password.",
  validateShort: ar ? `كلمة المرور الجديدة يجب ألا تقل عن ${MIN_LEN} أحرف.` : `New password must be at least ${MIN_LEN} characters.`,
  validateMismatch: ar ? "تأكيد كلمة المرور غير مطابق." : "Password confirmation does not match.",
  recoverySent: ar ? "تم إرسال رابط الاستعادة إلى بريدك." : "Recovery link sent to your email.",
});

export default function ChangePasswordPage() {
  const router = useRouter();
  const { isArabic } = useLangTheme();
  const t = tr(isArabic);
  const { show } = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [email, setEmail] = useState<string>("");

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  // جلسة + الإيميل
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        router.replace("/login");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!cancelled) setEmail(userData?.user?.email || "");
    })();
    return () => { cancelled = true; };
  }, [router]);

  const maskedEmail = useMemo(() => {
    if (!email) return "";
    const [u, d] = email.split("@");
    if (!u || !d) return email;
    const mu = u.length <= 2 ? u[0] + "*" : u[0] + "*".repeat(Math.max(1, u.length - 2)) + u.slice(-1);
    return `${mu}@${d}`;
  }, [email]);

  // فاليشن
  function validate(): string | null {
    if (!email) return t.validateNoAcct;
    if (!currentPass) return t.validateEnterCurr;
    if (!newPass) return t.validateEnterNew;
    if (newPass.length < MIN_LEN) return t.validateShort;
    if (confirmPass !== newPass) return t.validateMismatch;
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");

    const v = validate();
    if (v) { setErrorMsg(v); show(v, { type: "info" }); return; }

    try {
      setStage("checking");
      // إعادة تحقق من القديمة
      const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: currentPass });
      if (reauthErr) {
        setStage("error");
        setErrorMsg(t.wrongCurrent);
        show(t.wrongCurrent, { type: "error" });
        return;
      }

      setStage("updating");
      const { error: updErr } = await supabase.auth.updateUser({ password: newPass });
      if (updErr) {
        setStage("error");
        const msg = updErr.message || t.genericErr;
        setErrorMsg(msg);
        show(msg, { type: "error" });
        return;
      }

      // نجاح → اسأل عن تسجيل الخروج
      setStage("confirmLogout");
      show(t.okUpdated, { type: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.genericErr;
      setStage("error");
      setErrorMsg(message);
      show(message, { type: "error" });
    }
  }

  async function handleLogoutAll() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // Forgot password → send email then show toast then redirect
  async function handleForgot() {
    setErrorMsg("");
    if (!email) { const m = t.cannotSend; setErrorMsg(m); show(m, { type: "info" }); return; }

    try {
      setSendingRecovery(true);
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/change-password` : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        const msg = error.message || t.genericErr;
        setErrorMsg(msg);
        show(msg, { type: "error" });
      }else {
  // ✅ افتح البوب أب بدل ما يرجع فورًا
  setPopupOpen(true);
}
    } finally {
      setSendingRecovery(false);
    }
  }

  const busy = stage === "checking" || stage === "updating";

  return (
    <div
      style={{
        minHeight: "calc(100vh - var(--header-h))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <div style={{ width: "min(520px, 94vw)" }}>
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--card)",
            border: "1px solid var(--divider)",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>{t.title}</h2>

          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            {email ? (
              <>
                {t.accountLabel} <strong dir="ltr" lang="en">{maskedEmail}</strong>
              </>
            ) : (
              <>{t.loadingAcct}</>
            )}
          </div>

          {/* الحالية */}
          <label style={labelStyle}>{t.current}</label>
          <input
            type="password"
            value={currentPass}
            onChange={(e) => setCurrentPass(e.target.value)}
            placeholder={t.currentPh}
            disabled={busy}
            className="input-gold"
            style={inputStyle}
          />

          {/* الجديدة */}
          <label style={labelStyle}>{t.new}</label>
          <input
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder={t.newPh}
            disabled={busy}
            className="input-gold"
            style={inputStyle}
          />

          {/* التأكيد */}
          <label style={labelStyle}>{t.confirm}</label>
          <input
            type="password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder={t.confirmPh}
            disabled={busy}
            className="input-gold"
            style={inputStyle}
          />

          <small style={{ display: "block", color: "var(--muted)", marginBottom: 12 }}>
            {t.note}
          </small>

          {errorMsg && <div style={errorBox}>{errorMsg}</div>}

          {stage !== "confirmLogout" && (
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="submit" disabled={busy} style={primaryBtn(busy)}>
                {busy ? t.saving : t.save}
              </button>
              <button type="button" onClick={() => router.back()} disabled={busy} style={secondaryBtn}>
                {t.back}
              </button>
            </div>
          )}

          {stage === "confirmLogout" && (
            <div style={{ marginTop: 18 }}>
              <p style={{ marginBottom: 12 }}>
                ✅ {t.okUpdated}
                <br />
                {t.askLogout}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleLogoutAll}
                  style={{ ...primaryBtn(false), background: "#e11d48", color: "#fff" }}
                >
                  {t.yesLogoutAll}
                </button>
                <button type="button" onClick={() => router.replace("/")} style={secondaryBtn}>
                  {t.stayLogged}
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Forgot password under the card */}
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <button
            type="button"
            onClick={handleForgot}
            disabled={sendingRecovery}
            style={{
              background: "transparent",
              color: "var(--text)",
              border: "none",
              textDecoration: "underline",
              cursor: sendingRecovery ? "wait" : "pointer",
              opacity: sendingRecovery ? 0.7 : 1,
              padding: 6,
              fontSize: 14,
            }}
          >
            {sendingRecovery ? (isArabic ? "يتم إرسال الرابط…" : "Sending link…") : (isArabic ? "نسيت كلمة المرور؟" : "Forgot password?")}
          </button>
        </div>
      </div>
      <PopupDialog
  open={popupOpen}
  title={isArabic ? "تم إرسال رابط الاستعادة" : "Recovery Link Sent"}
  message={
    isArabic
      ? "تفقد بريدك الإلكتروني لاستعادة كلمة المرور."
      : "Please check your email to reset your password."
  }
  confirmText={isArabic ? "حسنًا" : "OK"}
  onClose={() => {
    setPopupOpen(false);
    router.replace("/"); // ← يرجع بعد الضغط على حسنًا
  }}
/>
    </div>
  );
}

/* ===== Styles ===== */
const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  color: "var(--muted)",
};
const inputStyle: React.CSSProperties = { width: "100%", marginBottom: 12 };
const errorBox: React.CSSProperties = {
  marginBottom: 12,
  color: "#ffb4b4",
  background: "rgba(255,0,0,0.08)",
  border: "1px solid rgba(255,0,0,0.25)",
  padding: "8px 10px",
  borderRadius: 8,
  fontSize: 13,
};
const primaryBtn = (busy: boolean): React.CSSProperties => ({
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: busy ? "wait" : "pointer",
  opacity: busy ? 0.7 : 1,
});
const secondaryBtn: React.CSSProperties = {
  background: "var(--card)",
  color: "var(--text)",
  border: "1px solid var(--divider)",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};
