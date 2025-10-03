"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useLangTheme } from "@/hooks/useLangTheme";

/* ========= Supabase client ========= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

/* ========= Types ========= */
type Role = "admin" | "super_admin" | string;

type StoredUser = {
  id: string;
  username?: string;
  role?: Role;
  email?: string;
  auth_user_id?: string;
};

type ClientRow = {
  id: string;
  name: string | null;
  name_ar?: string | null;
  logo_url?: string | null; // من v_user_company_profile → client_logo_filename
};

type TLUser = { username: string };

type MarketRow = { region?: string; city?: string; name?: string };
type UserRow = { id?: string; username?: string; role?: string };

/* ========= Helpers ========= */
const LS_KEYS = {
  currentUser: "currentUser",
  lang: "lang",
  clientId: "client_id",
} as const;

function parseStoredUser(json: string | null): StoredUser | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as StoredUser;
  } catch {
    return null;
  }
}

function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const ls = localStorage.getItem(LS_KEYS.currentUser);
    if (ls) return parseStoredUser(ls);
    const ss = sessionStorage.getItem(LS_KEYS.currentUser);
    if (ss) return parseStoredUser(ss);
  } catch {}
  return null;
}

function toAvatarPublicUrl(raw?: string | null) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!supabaseUrl) return "";
  return `${supabaseUrl}/storage/v1/object/public/avatars/${raw}`;
}

/* ========= Hook: إعادة الجلب عند التركيز/الرجوع ========= */
function useRefreshOnFocus(cb: () => void) {
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);
  useEffect(() => {
    cbRef.current();
    const onFocus = () => cbRef.current();
    const onVisible = () => {
      if (document.visibilityState === "visible") cbRef.current();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}

/* ========= الصفحة ========= */
export default function AdminDashboardPage() {
  const router = useRouter();

  /* IDs للاستخدام المتكرر */
  const [clientId, setClientId] = useState<string | null>(null);

  /* ========= App state ========= */
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [logoModalOpen, setLogoModalOpen] = useState(false);

  // الاتجاه (اللغة بتتظبط من الهيدر العالمي)
  const { isArabic } = useLangTheme();

  // التاريخ
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // الفلاتر
  const [regions, setRegions] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TLUser[]>([]);

  // القيم المختارة
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [selectedTeamLeader, setSelectedTeamLeader] = useState<string>("");

  // بيانات العميل
  const [client, setClient] = useState<ClientRow | null>(null);
  const [headerInfo, setHeaderInfo] = useState<{
    user_name_en?: string;
    user_name_ar?: string;
    client_name_en?: string;
    client_name_ar?: string;
    client_logo_filename?: string;
  } | null>(null);

  // Loading indicators
  const [loadingClient, setLoadingClient] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);

  /* ========= جارِد: تحقق جلسة + مستخدم + دور ========= */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = getStoredUser();
        if (!stored?.id) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        const hasSession = !!data?.session && !error;
        if (!hasSession) {
          try {
            localStorage.removeItem(LS_KEYS.currentUser);
            sessionStorage.removeItem(LS_KEYS.currentUser);
          } catch {}
          router.replace("/login");
          return;
        }

        const role = String(stored.role || "").toLowerCase();
        const allowed = role === "admin" || role === "super_admin";
        if (!allowed) {
          router.replace("/no-access");
          return;
        }

        if (!cancelled) {
          setUser(stored);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);
  const welcomeName = useMemo(() => {
    const fromView = isArabic
      ? headerInfo?.user_name_ar
      : headerInfo?.user_name_en;
    return fromView || user?.username || "";
  }, [headerInfo, isArabic, user?.username]);

  /* ========= جلب بيانات الهيدر والعميل من الـ View ========= */
  const resolveClientAndDetails = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const authUid = session?.session?.user?.id;
    if (!authUid) return;

    setLoadingClient(true);

    const { data, error } = await supabase
      .from("v_user_company_profile")
      .select("*")
      .eq("auth_user_id", authUid)
      .single();

    if (!error && data) {
      setClientId(data.client_id);
      try {
        localStorage.setItem(LS_KEYS.clientId, data.client_id);
      } catch {}

      // نخزن قيم الهيدر من الـ View
      setHeaderInfo({
        user_name_en: data.user_name_en,
        user_name_ar: data.user_name_ar,
        client_name_en: data.client_name_en,
        client_name_ar: data.client_name_ar,
        client_logo_filename: data.client_logo_filename,
      });

      // احتفظ بالـ client كمان لو محتاجه لاحقًا
      setClient({
        id: data.client_id,
        name: data.client_name_en,
        name_ar: data.client_name_ar,
        logo_url: data.client_logo_filename,
      });
    }

    setLoadingClient(false);
  }, []);

  /* ========= جلب Team Leaders المرتبطين بالعميل فقط ========= */
  const fetchClientTeamLeaders = useCallback(async () => {
    if (!clientId) return;
    setLoadingFilters(true);

    // نجيب user_ids من client_users لنفس العميل (active)
    const { data: cuList } = await supabase
      .from("client_users")
      .select("user_id")
      .eq("client_id", clientId)
      .eq("is_active", true);

    const userIds: string[] =
      (cuList || []).map((r: { user_id: string }) => r.user_id).filter(Boolean);

    if (userIds.length === 0) {
      setTeamLeaders([]);
      setLoadingFilters(false);
      return;
    }

    // نجيب الـ users من Users رول Team Leader فقط
    const { data: uData } = await supabase
      .from("Users")
      .select("id,username,role")
      .in("id", userIds)
      .in("role", ["Team Leader", "team_leader", "TEAM_LEADER", "Team_Leader"]);

    const tls: TLUser[] = ((uData as UserRow[]) || [])
      .map((u) => ({ username: String(u.username || "") }))
      .filter((u) => !!u.username);

    setTeamLeaders(tls);
    setLoadingFilters(false);
  }, [clientId]);

  /* ========= جلب Markets/Regions/Cities (لو حبيت تربطها بالعميل لاحقًا) ========= */
  const fetchBasicFilters = useCallback(async () => {
    setLoadingFilters(true);

    const { data: mkts } = await supabase
      .from("Markets")
      .select("region, city, name");

    const regionsSet = new Set<string>();
    const citiesSet = new Set<string>();
    const marketsSet = new Set<string>();

    ((mkts as MarketRow[]) || []).forEach((r) => {
      if (r.region) regionsSet.add(r.region);
      if (r.city) citiesSet.add(r.city);
      if (r.name) marketsSet.add(r.name);
    });

    setRegions([...regionsSet].sort());
    setCities([...citiesSet].sort());
    setMarkets([...marketsSet].sort());
    setLoadingFilters(false);
  }, []);

  /* ========= ربط الجلبات ========= */
  useEffect(() => {
    resolveClientAndDetails();
  }, [resolveClientAndDetails]);

  useEffect(() => {
    fetchBasicFilters();
  }, [fetchBasicFilters]);

  useEffect(() => {
    if (!clientId) return;
    fetchClientTeamLeaders();
  }, [clientId, fetchClientTeamLeaders]);

  /* ========= إعادة الجلب عند التركيز ========= */
  useRefreshOnFocus(() => {
    resolveClientAndDetails();
    fetchBasicFilters();
    if (clientId) fetchClientTeamLeaders();
  });

  /* ========= Handlers ========= */
  const onFromChange = (v: string) => {
    // From ≤ To
    if (dateTo && v && new Date(v) > new Date(dateTo)) {
      setDateTo(v);
    }
    setDateFrom(v);
  };

  const onToChange = (v: string) => {
    if (dateFrom && v && new Date(v) < new Date(dateFrom)) {
      setDateFrom(v);
    }
    setDateTo(v);
  };

  /* ========= Derivations ========= */
  const clientDisplayName = useMemo(() => {
    const fallback = isArabic ? "اسم الشركة" : "Company Name";
    if (!headerInfo) return client?.name || client?.name_ar || fallback;

    const fromView = isArabic
      ? headerInfo.client_name_ar || headerInfo.client_name_en
      : headerInfo.client_name_en || headerInfo.client_name_ar;
    return fromView || client?.name || client?.name_ar || fallback;
  }, [headerInfo, client, isArabic]);

  const clientLogoUrl = useMemo(
    () => toAvatarPublicUrl(headerInfo?.client_logo_filename || client?.logo_url),
    [headerInfo?.client_logo_filename, client?.logo_url]
  );

  /* ========= Data (mock) ========= */
  const orderedStats = useMemo(() => {
    const stats = [
      { value: 519, label: "Total Visits", percentage: 70 },
      { value: 411, label: "Completed Visits", percentage: 55 },
      { value: 108, label: "False Visits", percentage: 25 },
      { value: 79, label: "Completed %", percentage: 79 },
      { value: 21, label: "False %", percentage: 21 },
      { value: 22, label: "Total Available", percentage: 80 },
      { value: 34, label: "Total Items", percentage: 65 },
      { value: 11, label: "Not Available", percentage: 30 },
      { value: "00:00", label: "Avg Visit Time", percentage: 65 },
      { value: "00:00", label: "Total Travel Time", percentage: 50 },
    ];

    const priority = ["Total Items", "Total Available", "Not Available"];
    const first = stats
      .filter((s) => priority.includes(s.label))
      .sort((a, b) => priority.indexOf(a.label) - priority.indexOf(b.label));
    const rest = stats.filter((s) => !priority.includes(s.label));

    return [...first, ...rest];
  }, []);

  /* ========= UI ========= */
  if (booting) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        <div
          style={{
            padding: 24,
            borderRadius: 8,
            background: "var(--card)",
            border: "1px solid var(--divider)",
          }}
        >
          {isArabic ? "جارٍ التحقق من الجلسة…" : "Checking session…"}
        </div>
      </div>
    );
  }

  if (!user) {
    return <p style={{ padding: "2rem" }}>Loading…</p>;
  }

  return (
    <div
      style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}
    >
      {/* ✅ الهيدر العالمي ثابت من layout — مفيش AppHeader هنا */}

      {/* SubHeader — 50% width centered */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
        <div
          style={{
            width: "50vw",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--card)",
            border: "1px solid var(--divider)",
            borderRadius: 12,
            padding: "10px 14px",
          }}
        >
          {clientLogoUrl ? (
            <Image
              src={clientLogoUrl}
              alt="Client Logo"
              width={36}
              height={36}
              style={{
                borderRadius: 8,
                objectFit: "contain",
                cursor: "pointer",
              }}
              onClick={() => setLogoModalOpen(true)}
            />
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "var(--chip-bg)",
                border: "1px solid var(--divider)",
              }}
            />
          )}

          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontWeight: 700 }}>
              {isArabic ? "مرحبًا" : "Welcome"} {welcomeName}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {loadingClient
                ? isArabic
                  ? "جاري التحميل…"
                  : "Loading…"
                : clientDisplayName}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Capsule */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 12,
          marginBottom: 12,
        }}
      >
        <div style={capsuleStyle}>
          <CapsuleItem label={isArabic ? "المنطقة" : "Region"}>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={capsuleSelect}
              disabled={loadingFilters}
            >
              <option value="">{isArabic ? "الكل" : "All"}</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </CapsuleItem>

          <CapsuleItem label={isArabic ? "المدينة" : "City"}>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              style={capsuleSelect}
              disabled={loadingFilters}
            >
              <option value="">{isArabic ? "الكل" : "All"}</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </CapsuleItem>

          <CapsuleItem label={isArabic ? "السوق" : "Market"}>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              style={capsuleSelect}
              disabled={loadingFilters}
            >
              <option value="">{isArabic ? "الكل" : "All"}</option>
              {markets.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </CapsuleItem>

          <CapsuleItem label={isArabic ? "قائد الفريق" : "Team Leader"}>
            <select
              value={selectedTeamLeader}
              onChange={(e) => setSelectedTeamLeader(e.target.value)}
              style={capsuleSelect}
              disabled={loadingFilters}
            >
              <option value="">{isArabic ? "الكل" : "All"}</option>
              {teamLeaders.map((t) => (
                <option key={t.username} value={t.username}>
                  {t.username}
                </option>
              ))}
            </select>
          </CapsuleItem>

          <CapsuleItem label={isArabic ? "من" : "Date From"}>
            {/* Native Date Picker + فاليشن From ≤ To */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onFromChange(e.target.value)}
              onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
              style={capsuleInput}
            />
          </CapsuleItem>

          <CapsuleItem label={isArabic ? "إلى" : "Date To"}>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onToChange(e.target.value)}
              onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
              style={capsuleInput}
            />
          </CapsuleItem>
        </div>
      </div>

      <hr
        style={{
          margin: "0 20px 20px",
          border: "none",
          borderTop: "1px solid var(--divider)",
        }}
      />

      {/* Stats rows */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 20,
          marginBottom: 20,
        }}
      >
        {orderedStats.slice(0, 5).map((stat, idx) => (
          <StatCard key={`top-${idx}`} stat={stat} isArabic={isArabic} />
        ))}
      </div>

      <hr
        style={{
          margin: "0 20px 20px",
          border: "none",
          borderTop: "1px solid var(--divider)",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 20,
          marginBottom: 20,
        }}
      >
        {orderedStats.slice(5).map((stat, idx) => (
          <StatCard key={`bottom-${idx}`} stat={stat} isArabic={isArabic} />
        ))}
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          paddingBottom: 32,
        }}
      >
        <button style={primaryBtnStyle}>
          {isArabic ? "إرسال الإشعارات" : "Send Notifications"}
        </button>
        <button style={primaryBtnStyle}>
          {isArabic ? "التقارير المفصلة" : "Detailed Reports"}
        </button>
      </div>

      {/* --- Logo Modal --- */}
      {logoModalOpen && (
        <div style={overlayStyle} onClick={() => setLogoModalOpen(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{clientDisplayName}</h3>
            {clientLogoUrl && (
              <Image
                src={clientLogoUrl}
                alt="Client Logo Large"
                width={250}
                height={250}
                style={{ objectFit: 'contain', margin: '20px 0' }}
              />
            )}
            <button onClick={() => setLogoModalOpen(false)} style={primaryBtnStyle}>
              {isArabic ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========= Small components & styles ========= */

const capsuleStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "var(--card)",
  border: "1px solid var(--divider)",
  borderRadius: 9999,
  padding: 6,
};

const itemShell: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  borderRadius: 9999,
  padding: "6px 10px",
};

const itemLabel: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};

const chevronStyle: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.7,
  marginInlineStart: 2,
};

const baseField: React.CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--input-text)",
  fontSize: 13,
  minWidth: 110,
};

const capsuleSelect: React.CSSProperties = {
  ...baseField,
  appearance: "none",
  paddingInlineEnd: 14,
};

const capsuleInput: React.CSSProperties = {
  ...baseField,
  minWidth: 130,
};

function CapsuleItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={itemShell}>
      <span style={itemLabel}>{label}</span>
      <span style={chevronStyle}>▾</span>
      {children}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  backgroundColor: "var(--accent)",
  color: "var(--accent-foreground)",
  padding: "10px 16px",
  border: "none",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};

function StatCard({
  stat,
  isArabic,
}: {
  stat: { value: number | string; label: string; percentage: number };
  isArabic: boolean;
}) {
  const labels: Record<string, string> = {
    "Total Visits": isArabic ? "إجمالي الزيارات" : "Total Visits",
    "Completed Visits": isArabic ? "الزيارات المكتملة" : "Completed Visits",
    "False Visits": isArabic ? "زيارات وهمية" : "False Visits",
    "Completed %": isArabic ? "نسبة الإكمال" : "Completed %",
    "False %": isArabic ? "نسبة الوهمية" : "False %",
    "Total Available": isArabic ? "إجمالي المتاح" : "Total Available",
    "Not Available": isArabic ? "غير متاح" : "Not Available",
    "Avg Visit Time": isArabic ? "متوسط وقت الزيارة" : "Avg Visit Time",
    "Total Travel Time": isArabic ? "إجمالي وقت التنقل" : "Total Travel Time",
    "Total Items": isArabic ? "إجمالي الأصناف" : "Total Items",
  };

  return (
    <div
      style={{
        width: 160,
        textAlign: "center",
        backgroundColor: "var(--card)",
        border: "1px solid var(--divider)",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ width: 110, height: 110, margin: "0 auto" }}>
        <CircularProgressbar
          value={typeof stat.percentage === "number" ? stat.percentage : 0}
          text={`${stat.value}`}
          styles={buildStyles({
            textColor: "var(--text)",
            pathColor: "var(--accent)",
            trailColor: "var(--chip-bg)",
          })}
        />
      </div>
      <p style={{ marginTop: 10, fontSize: 13 }}>
        {labels[stat.label] ?? stat.label}
      </p>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--card)',
  padding: '2rem',
  borderRadius: '12px',
  border: '1px solid var(--divider)',
  textAlign: 'center',
  color: 'var(--text)',
};