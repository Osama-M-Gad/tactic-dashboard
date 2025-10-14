/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import { useLangTheme } from "@/hooks/useLangTheme";

/* ========= Types ========= */
type UUID = string;

type PortalUser = {
  id: UUID;
  role: string;
  username?: string;
  name?: string | null;
  arabic_name?: string | null;
};

type ClientLite = { id: UUID; name: string | null; name_ar: string | null };
type UserLite   = { id: UUID; name: string | null; arabic_name: string | null };

type SendReportResponse = { ok?: boolean; sent?: number; error?: string };

/* ========= Helpers (normalize + dedupe + sort) ========= */
const norm = (s: unknown) => String(s ?? "").trim();
const uniqSorted = (arr: Array<string | null | undefined>) =>
  Array.from(new Set(arr.filter((v): v is string => !!v).map(norm)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ar"));

/* ========= Page ========= */
export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const { isArabic } = useLangTheme();

  const [user, setUser] = useState<PortalUser | null>(null);
  const [profile, setProfile] = useState<Pick<PortalUser, "name" | "arabic_name"> | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Popup state
  const [sendOpen, setSendOpen] = useState(false);

  // Dropdown data
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const [clientUsers, setClientUsers] = useState<UserLite[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Extra filters (region / city / store / status)
  const [region, setRegion] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [store, setStore] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  // Recipients (multi-select)
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);

  // Options for dropdowns
  const [regionsOpts, setRegionsOpts] = useState<string[]>([]);
  const [citiesOpts, setCitiesOpts] = useState<string[]>([]);
  const [storesOpts, setStoresOpts] = useState<string[]>([]);
  const [recipientsOpts, setRecipientsOpts] = useState<string[]>([]);

  /* ===== Gate ===== */
  useEffect(() => {
    const raw =
      (typeof window !== "undefined" && localStorage.getItem("currentUser")) ||
      (typeof window !== "undefined" && sessionStorage.getItem("currentUser"));
    if (!raw) {
      router.replace("/login");
      return;
    }
    const u = JSON.parse(raw) as PortalUser;
    const role = String(u?.role || "").toLowerCase();
    if (role === "admin") {
      router.replace("/admin/dashboard");
      return;
    }
    if (role !== "super_admin") {
      router.replace("/login");
      return;
    }
    setUser(u);
  }, [router]);

  /* ===== User name ===== */
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("Users")
        .select("name, arabic_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setProfile({ name: data.name ?? null, arabic_name: data.arabic_name ?? null });
      else setProfile({ name: user.name ?? user.username ?? "", arabic_name: user.arabic_name ?? null });
    };
    if (user) fetchProfile();
  }, [user]);

  /* ===== Theme ===== */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const initial: "dark" | "light" = saved ?? "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const displayName = useMemo(() => {
    if (!profile) return "";
    return isArabic ? (profile.arabic_name || profile.name || "") : (profile.name || profile.arabic_name || "");
  }, [profile, isArabic]);

  /* ===== Load clients on open ===== */
  useEffect(() => {
    if (!sendOpen) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("client")
          .select("id, name, name_ar")
          .order("name", { ascending: true });
        setClients((data as ClientLite[]) ?? []);
      } catch {
        const { data: fallback } = await supabase
          .from("client")
          .select("id, name, name_ar")
          .order("id", { ascending: false })
          .limit(500);
        setClients((fallback as ClientLite[]) ?? []);
      }
    })();
  }, [sendOpen]);

  /* === Load dropdown options (regions/cities/stores/recipients) — بدون .returns === */
  useEffect(() => {
    if (!sendOpen) return;

    // helper: apply client filter if chosen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byClient = (q: any) => (selectedClientId ? q.eq("client_id", selectedClientId) : q);

    (async () => {
      // Regions
      const { data: regRows } = await byClient(
        supabase
          .from("visits_details_v")
          .select("market_region")
          .not("market_region", "is", null)
          .order("market_region", { ascending: true })
      );
      setRegionsOpts(
        uniqSorted(
          (regRows ?? []).map((r: { market_region: string | null }) => r.market_region)
        )
      );

      // Cities (dependent on region if chosen)
      let citiesQ = byClient(
        supabase
          .from("visits_details_v")
          .select("market_city, market_region")
          .not("market_city", "is", null)
      );
      if (region) citiesQ = citiesQ.eq("market_region", region);
      const { data: citRows } = await citiesQ.order("market_city", { ascending: true });
      setCitiesOpts(
        uniqSorted(
          (citRows ?? []).map((r: { market_city: string | null }) => r.market_city)
        )
      );

      // Stores (dependent on region/city if chosen)
      let storesQ = byClient(
        supabase
          .from("visits_details_v")
          .select("market_store, market_region, market_city")
          .not("market_store", "is", null)
      );
      if (region) storesQ = storesQ.eq("market_region", region);
      if (city)   storesQ = storesQ.eq("market_city",   city);
      const { data: stoRows } = await storesQ.order("market_store", { ascending: true });
      setStoresOpts(
        uniqSorted(
          (stoRows ?? []).map((r: { market_store: string | null }) => r.market_store)
        )
      );

      // Recipients from scheduled_email_reports (filtered by client if selected)
      let recQ = supabase
        .from("scheduled_email_reports")
        .select("recipient_email")
        .eq("is_active", true)
        .order("recipient_email", { ascending: true });
      if (selectedClientId) recQ = recQ.eq("client_id", selectedClientId);
      const { data: recRows } = await recQ;
      setRecipientsOpts(
        uniqSorted((recRows ?? []).map((r: { recipient_email: string | null }) => r.recipient_email))
      );
    })();
    // reload when these change
  }, [sendOpen, selectedClientId, region, city]);

  /* ===== Load users of selected client ===== */
  useEffect(() => {
    if (!selectedClientId) {
      setClientUsers([]);
      setSelectedUserId("");
      return;
    }

    (async () => {
      try {
        const { data: links } = await supabase
          .from("client_users")
          .select("user_id")
          .eq("client_id", selectedClientId);

        const ids = Array.from(new Set(((links ?? []) as { user_id: UUID }[]).map((r) => r.user_id)));
        if (ids.length === 0) {
          setClientUsers([]);
          setSelectedUserId("");
          return;
        }

        const { data: users } = await supabase
          .from("Users")
          .select("id, name, arabic_name")
          .in("id", ids)
          .order("name", { ascending: true });

        setClientUsers((users as UserLite[]) ?? []);
      } catch (err) {
        console.error("client users fetch error:", err);
        setClientUsers([]);
        setSelectedUserId("");
      }
    })();
  }, [selectedClientId]);

  /* ===== Send handler ===== */
  const handleSendDailyReport = async () => {
    if (isSending) return;
    setIsSending(true);

    try {
      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      if (!session) {
        alert(isArabic ? "من فضلك سجّل الدخول أولاً." : "Please login first.");
        router.push("/login");
        return;
      }

      // Body
      const body: Record<string, unknown> = {};
      if (selectedClientId) body.client_id = selectedClientId;
      if (selectedClientId && selectedUserId) body.user_id = selectedUserId;

      // فلاتر إضافية
      if (region.trim()) body.region = region.trim();
      if (city.trim())   body.city   = city.trim();
      if (store.trim())  body.store  = store.trim();
      if (status.trim()) body.status = status.trim().toLowerCase();

      // تحديد المستلمين (اختياري) من الـ multi-select
      if (selectedRecipients.length > 0) body.recipient_emails = selectedRecipients;

      const { data, error } = await supabase.functions.invoke<SendReportResponse>("send-daily-report", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });
      if (error) throw error;

      const sent = data?.sent ?? 0;
      alert(isArabic ? `تم الإرسال ✅ (عدد: ${sent})` : `Sent ✅ (count: ${sent})`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert((isArabic ? "فشل الإرسال: " : "Failed: ") + msg);
    } finally {
      setSelectedClientId("");
      setSelectedUserId("");
      setRegion("");
      setCity("");
      setStore("");
      setStatus("");
      setSelectedRecipients([]);
      setIsSending(false);
      setSendOpen(false);
    }
  };

  /* ===== UI Texts ===== */
  const T = useMemo(() => {
    return isArabic
      ? {
          welcome: "مرحباً",
          footer: "جميع الحقوق محفوظة لشركة Tactic & creativity",
          buttons: [
            "تقارير كل العملاء",
            "إضافة عميل جديد",
            "إدارة التقارير البريدية",
            "ارسال زيارات أمس",
            "إضافة مستخدم لعميل محدد",
            "إضافة منتجات لعميل محدد",
            "إضافة خواص/مميزات للعميل",
            "إضافة أسواق للعميل",
            "إضافة زيارة لمستخدم محدد - عميل",
            "تحضير التقارير",
            "إيقاف عميل",
            "إضافة مديرين للعميل",
            "إدخال أسواق (بصفة عامة)",
            "إدخال فئات (بصفة عامة)",
          ],
        }
      : {
          welcome: "Welcome",
          footer: "all right reserved for Tactic & creativity",
          buttons: [
            "ALL CLIENTS REPORTS",
            "ADD NEW CLIENT",
            "Manage Email Reports",
            "Yestrday visit Email",
            "ADD NEW USER FOR CHOSEN CLIENT",
            "ADD PRODUCTS FOR CHOSEN CLIENT",
            "ADD FEATURES FOR CLIENT",
            "ADD MARKETS FOR CLIENT",
            "ADD VISIT FOR SELECTED USER - CLIENT",
            "PREPARE REPORTING",
            "CLIENT STOP",
            "ADD ADMINS FOR CLIENT",
            "ADD MARKETS (GENERAL)",
            "ADD CATEGORIES (GENERAL)",
          ],
        };
  }, [isArabic]);

  if (!user) {
    return <div style={{ color: "var(--text)", padding: 24 }}>Loading…</div>;
  }

  const buttonStyle: React.CSSProperties = {
    backgroundColor: "#555",
    color: "#ddd",
    padding: "14px 18px",
    border: "2px solid #f5a623",
    borderRadius: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    minWidth: 280,
    cursor: "pointer",
    boxShadow: "0 0 0 2px #2b2b2b inset",
    transition: "background-color 0.2s",
  };

  /* ========= Render ========= */
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "10px 20px",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          borderBottom: "1px solid var(--divider)",
          position: "relative",
          minHeight: 52,
        }}
      >
        <h2
          style={{
            fontWeight: 600,
            margin: 0,
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            whiteSpace: "nowrap",
          }}
        >
          {T.welcome} ({displayName || (isArabic ? "اسم المستخدم" : "User Name")})
        </h2>
        <div style={{ display: "flex", gap: 10 }}>{/* header actions */}</div>
      </div>

      <div
        style={{
          maxWidth: 980,
          margin: "24px auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          width: "100%",
          padding: "0 20px",
          flexGrow: 1,
        }}
      >
        {T.buttons.map((label) => {
          const isSendButton = label === "ارسال زيارات أمس" || label === "Yestrday visit Email";
          return (
            <button
              key={label}
              style={{ ...buttonStyle, width: "100%", height: 70, opacity: isSendButton && isSending ? 0.6 : 1 }}
              disabled={isSendButton && isSending}
              onClick={() => {
                if (label === "ADD NEW CLIENT" || label === "إضافة عميل جديد") {
                  router.push("/super-admin/clients/new");
                } else if (label === "Manage Email Reports" || label === "إدارة التقارير البريدية") {
                  router.push("/super-admin/email-reports");
                } else if (isSendButton) {
                  setSendOpen(true); // افتح الـPopup
                }
              }}
            >
              {isSendButton && isSending ? (isArabic ? "جاري الإرسال..." : "Sending...") : label}
            </button>
          );
        })}
      </div>

      {/* Popup */}
      {sendOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: 520,
              maxWidth: "95%",
              background: "var(--card)",
              border: "1px solid var(--divider)",
              borderRadius: 10,
              padding: 20,
              boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 14, textAlign: "center" }}>
              {isArabic ? "إرسال التقارير" : "Send Reports"}
            </h3>

            {/* Client */}
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <label style={{ fontWeight: 600 }}>
                {isArabic ? "اختر العميل (اختياري)" : "Select client (optional)"}
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  // reset dependent selections
                  setSelectedUserId("");
                  setRegion("");
                  setCity("");
                  setStore("");
                  setSelectedRecipients([]);
                }}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid var(--divider)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                }}
              >
                <option value="">{isArabic ? "الكل" : "All clients"}</option>
                {clients.map((c, idx) => (
                  <option key={`${c.id}-${idx}`} value={c.id}>
                    {isArabic ? c.name_ar || c.name || c.id : c.name || c.name_ar || c.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Users */}
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>
                {isArabic ? "اختر مستخدم من العميل (اختياري)" : "Select a user of the client (optional)"}
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={!selectedClientId}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid var(--divider)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                  opacity: selectedClientId ? 1 : 0.6,
                }}
              >
                <option value="">{isArabic ? "الكل" : "All users"}</option>
                {clientUsers.map((u, idx) => (
                  <option key={`${u.id}-${idx}`} value={u.id}>
                    {isArabic ? u.arabic_name || u.name || u.id : u.name || u.arabic_name || u.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Filters */}
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>
                {isArabic ? "المنطقة (اختياري)" : "Region (optional)"}
              </label>
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setCity("");
                  setStore("");
                }}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid var(--divider)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                }}
              >
                <option value="">{isArabic ? "الكل" : "All"}</option>
                {regionsOpts.map((r, idx) => (
                  <option key={`${r}-${idx}`} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>
                {isArabic ? "المدينة (اختياري)" : "City (optional)"}
              </label>
              <select
                value={city}
                onChange={(e) => { setCity(e.target.value); setStore(""); }}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid var(--divider)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                }}
              >
                <option value="">{isArabic ? "الكل" : "All"}</option>
                {citiesOpts.map((c, idx) => (
                  <option key={`${c}-${idx}`} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>
                {isArabic ? "السوق/المتجر (اختياري)" : "Store/Market (optional)"}
              </label>
              <select
                value={store}
                onChange={(e) => setStore(e.target.value)}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid var(--divider)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                }}
              >
                <option value="">{isArabic ? "الكل" : "All"}</option>
                {storesOpts.map((s, idx) => (
                  <option key={`${s}-${idx}`} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>
                {isArabic ? "الحالة (اختياري)" : "Status (optional)"}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid var(--divider)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                }}
              >
                <option value="">{isArabic ? "الكل" : "All"}</option>
                <option value="finished">{isArabic ? "مكتملة" : "Finished"}</option>
                <option value="ended">{isArabic ? "منتهية" : "Ended"}</option>
                <option value="pending">{isArabic ? "معلقة" : "Pending"}</option>
              </select>
            </div>

            {/* Recipients (multi-select from DB) */}
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>
                {isArabic ? "المستلمون (اختياري)" : "Recipients (optional)"}
              </label>
              <select
                multiple
                value={selectedRecipients}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setSelectedRecipients(opts);
                }}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid var(--divider)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                  minHeight: 96,
                }}
              >
                {recipientsOpts.map((em, idx) => (
                  <option key={`${em}-${idx}`} value={em}>{em}</option>
                ))}
              </select>
              <small style={{ color: "var(--muted)" }}>
                {isArabic ? "اتركها فارغة لإرسالها لكل المستلمين المفعّلين." : "Leave empty to send to all active recipients."}
              </small>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setSendOpen(false);
                  setSelectedClientId("");
                  setSelectedUserId("");
                  setRegion(""); setCity(""); setStore(""); setStatus("");
                  setSelectedRecipients([]);
                }}
                style={{
                  padding: "8px 14px",
                  border: "1px solid var(--divider)",
                  background: "transparent",
                  color: "var(--text)",
                  borderRadius: 6,
                }}
              >
                {isArabic ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleSendDailyReport}
                style={{
                  padding: "8px 14px",
                  background: "var(--accent)",
                  color: "var(--accent-foreground)",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 700,
                }}
              >
                {isSending ? (isArabic ? "جاري الإرسال..." : "Sending...") : (isArabic ? "إرسال" : "Send")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: "18px 0", marginTop: "auto" }}>
        {T.footer}
      </div>
    </div>
  );
}
