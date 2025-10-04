"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { CircularProgressbar, CircularProgressbarWithChildren, buildStyles } from "react-circular-progressbar";
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
  logo_url?: string | null;
};

type TLUser = { id: string; username: string };

// 👇 مهم: في Markets الحقول region / city / store
type MarketRow = { id?: string; region?: string | null; city?: string | null; store?: string | null };
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

const ORDER_TOP = Object.freeze([
  "Total Visits",
  "Completed Visits",
  "False Visits",
  "Completed %",
  "False %",
] as const);

const ORDER_BOTTOM = Object.freeze([
  "Total Items",
  "Total Available",
  "Not Available",
  "Avg Visit Time",      // سنعرضه كـ "إجمالي وقت الزيارة"
  "Total Travel Time",   // إجمالي وقت التنقل
] as const);

/* ========= Helper: Fetch all rows (for large tables with pagination) ========= */
type FilterValue = string | number | boolean | null;
type Filters = Record<string, FilterValue>;

async function fetchAllRows<T extends Record<string, unknown>>(
  table: string,
  filters: Filters,
  selectExp: string = "*"
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  let to = pageSize - 1;
  const out: T[] = [];

  while (true) {
    let q = supabase.from(table).select(selectExp);

    // طبّق الفلاتر
    for (const k in filters) {
      q = q.eq(k, filters[k]);
    }

    const { data, error } = await q.range(from, to);
    if (error) {
      console.error(`[fetchAllRows] ${table}:`, error);
      break;
    }

    const rows = (data ?? []) as unknown as T[];
    if (rows.length === 0) break;

    out.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
    to += pageSize;
  }

  return out;
}

/* ========= Utils ========= */
function fmtHHMM(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
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

  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [totalAvailable, setTotalAvailable] = useState<number>(0);
  const [totalUnavailable, setTotalUnavailable] = useState<number>(0);
// ── Visit cards (Totals) ─────────────────────────
const [totalVisits, setTotalVisits] = useState(0);
const [finishedVisits, setFinishedVisits] = useState(0);
const [unfinishedVisits, setUnfinishedVisits] = useState(0);
const [finishedPct, setFinishedPct] = useState(0);
const [unfinishedPct, setUnfinishedPct] = useState(0);

  // الاتجاه (اللغة بتتظبط من الهيدر العالمي)
  const { isArabic } = useLangTheme();

  // التاريخ
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
// ضبّط نطاق افتراضي آخر 5 سنين بمجرد معرفة العميل
useEffect(() => {
  if (!clientId) return;

  const today = new Date();
  const to = today.toISOString().slice(0, 10);

  const fromDate = new Date(today);
  fromDate.setFullYear(fromDate.getFullYear() - 5); // آخر 5 سنوات
  const from = fromDate.toISOString().slice(0, 10);

  setDateFrom((prev) => prev || from);
  setDateTo((prev) => prev || to);
}, [clientId]);

  // أسواق العميل
  const [allMarkets, setAllMarkets] = useState<MarketRow[]>([]);

  // Team leaders
  const [teamLeaders, setTeamLeaders] = useState<TLUser[]>([]);

  // القيم المختارة
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
 const [selectedMarketName, setSelectedMarketName] = useState<string>("");
  const [selectedTeamLeader, setSelectedTeamLeader] = useState<string>(""); // user_id

  // Presence/Visit/Transit seconds
  const [presenceSeconds, setPresenceSeconds] = useState<number>(0);
  const [visitSeconds, setVisitSeconds] = useState<number>(0);
  const [transitSeconds, setTransitSeconds] = useState<number>(0);

  // بيانات العميل/الهيدر
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
    const fromView = isArabic ? headerInfo?.user_name_ar : headerInfo?.user_name_en;
    return fromView || user?.username || "";
  }, [headerInfo, isArabic, user?.username]);

  /* ========= جلب Availability (مثال قائم عندك) ========= */
  const fetchAvailabilityStats = useCallback(async () => {
  if (!clientId) return;
  // نطاق افتراضي: آخر 5 سنين لو المستخدم ما اختارش
  const today = new Date().toISOString().slice(0, 10);
  const fromDateObj = new Date();
  fromDateObj.setFullYear(fromDateObj.getFullYear() - 5);
  const fiveYearsAgo = fromDateObj.toISOString().slice(0, 10);

  const from_date = dateFrom || fiveYearsAgo;
  const to_date   = dateTo   || today;

  const { data, error } = await supabase.rpc("get_availability_totals", {
    p_client_id: clientId,
    p_from_date: from_date,
    p_to_date: to_date,
    p_region: selectedRegion || null,
    p_city: selectedCity || null,
    p_store: (selectedMarketName || "").trim() || null, // فلترة بالسوق بالاسم
    p_team_leader_id: selectedTeamLeader || null,       // Users.id لقائد الفريق
  });

  if (error) {
    console.error("[availability totals] RPC error:", error);
    setTotalProducts(0);
    setTotalAvailable(0);
    setTotalUnavailable(0);
    return;
  }

  const row = (data && data[0]) || { total_items: 0, total_available: 0, total_unavailable: 0 };
  setTotalProducts(Number(row.total_items || 0));
  setTotalAvailable(Number(row.total_available || 0));
  setTotalUnavailable(Number(row.total_unavailable || 0));
}, [clientId, dateFrom, dateTo, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader]);
// ── Visit cards RPC ──────────────────────────────
const fetchVisitCards = useCallback(async () => {
  if (!clientId) return;

  const today = new Date().toISOString().slice(0, 10);
  const d = new Date(); d.setFullYear(d.getFullYear() - 5);
  const fiveYearsAgo = d.toISOString().slice(0, 10);

  const from_date = dateFrom || fiveYearsAgo;
  const to_date   = dateTo   || today;

  const { data, error } = await supabase.rpc("get_visit_cards_totals", {
    p_client_id: clientId,
    p_from_date: from_date,
    p_to_date: to_date,
    p_region: selectedRegion || null,
    p_city: selectedCity || null,
    p_store: (selectedMarketName || "").trim() || null,
    p_team_leader_id: selectedTeamLeader || null,
  });

  if (error) {
    console.error("[visit cards] RPC error:", error);
    setTotalVisits(0);
    setFinishedVisits(0);
    setUnfinishedVisits(0);
    setFinishedPct(0);
    setUnfinishedPct(0);
    return;
  }

  const row = data?.[0] || {};
  setTotalVisits(Number(row.total_visits || 0));
  setFinishedVisits(Number(row.finished_visits || 0));
  setUnfinishedVisits(Number(row.unfinished_visits || 0));
  setFinishedPct(Number(row.finished_pct || 0));
  setUnfinishedPct(Number(row.unfinished_pct || 0));
}, [clientId, dateFrom, dateTo, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader]);

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

      setHeaderInfo({
        user_name_en: data.user_name_en,
        user_name_ar: data.user_name_ar,
        client_name_en: data.client_name_en,
        client_name_ar: data.client_name_ar,
        client_logo_filename: data.client_logo_filename,
      });

      setClient({
        id: data.client_id,
        name: data.client_name_en,
        name_ar: data.client_name_ar,
        logo_url: data.client_logo_filename,
      });
    }
   if (data?.client_id) {
  await fetchAvailabilityStats();
  await fetchVisitCards(); // ⬅️ إضافة
}
 }, [fetchAvailabilityStats, fetchVisitCards]);

  const goChangePassword = useCallback(() => {
    router.push("/change-password");
  }, [router]);
const goToDetailedReports = useCallback(() => {
  const params = new URLSearchParams();

  if (clientId)            params.set("clientId", clientId);
  if (selectedRegion)      params.set("region", selectedRegion);
  if (selectedCity)        params.set("city", selectedCity);
  if (selectedMarketName)  params.set("market", selectedMarketName);
  if (selectedTeamLeader)  params.set("tl", selectedTeamLeader);
  if (dateFrom)            params.set("from", dateFrom);
  if (dateTo)              params.set("to", dateTo);

  router.push(`/admin/reports?${params.toString()}`);
}, [
  router,
  clientId,
  selectedRegion,
  selectedCity,
  selectedMarketName,
  selectedTeamLeader,
  dateFrom,
  dateTo,
]);

  /* ========= جلب Team Leaders المرتبطين بالعميل فقط ========= */
  const fetchClientTeamLeaders = useCallback(async () => {
    if (!clientId) return;
    setLoadingFilters(true);

    const { data: cuList } = await supabase
      .from("client_users")
      .select("user_id")
      .eq("client_id", clientId)
      .eq("is_active", true);

    const userIds: string[] = (cuList || [])
      .map((r: { user_id: string }) => r.user_id)
      .filter(Boolean);

    if (userIds.length === 0) {
      setTeamLeaders([]);
      setLoadingFilters(false);
      return;
    }

    const { data: uData } = await supabase
      .from("Users")
      .select("id,username,role")
      .in("id", userIds)
      .in("role", ["Team Leader", "team_leader", "TEAM_LEADER", "Team_Leader"]);

    const tls: TLUser[] = ((uData as UserRow[]) || [])
      .map((u) => ({ id: String(u.id), username: String(u.username || "") }))
      .filter((u) => !!u.username);

    setTeamLeaders(tls);
    setLoadingFilters(false);
  }, [clientId]);

  /* ========= جلب أسواق العميل عبر زياراته ========= */
  const fetchClientMarkets = useCallback(async () => {
    if (!clientId) {
      setAllMarkets([]);
      return;
    }
    setLoadingFilters(true);

    // 1) هات كل الزيارات بتاعت العميل (مقسّمة صفحات)
    const allVisits = await fetchAllRows<{ market_id: string | null }>(
      "Visits",
      { client_id: clientId },
      "market_id"
    );

    // 2) IDs بدون تكرار
    const ids = Array.from(new Set(allVisits.map((v) => v.market_id).filter((x): x is string => !!x)));

    if (ids.length === 0) {
      setAllMarkets([]);
      setLoadingFilters(false);
      return;
    }

    // 3) تفاصيل الماركتس
    const { data, error } = await supabase
      .from("Markets")
      .select("id, region, city, store")
      .in("id", ids);

    if (error || !data) {
      console.error("Markets error", error);
      setAllMarkets([]);
      setLoadingFilters(false);
      return;
    }

    setAllMarkets(data);
    setLoadingFilters(false);
  }, [clientId]);

  /* ========= Presence/Visit/Transit من الـ VIEW الموحّد مع الفلاتر ========= */
  const fetchPresenceVisitTransit = useCallback(async () => {
    if (!clientId || !dateFrom || !dateTo) {
      setPresenceSeconds(0);
      setVisitSeconds(0);
      setTransitSeconds(0);
      return;
    }

    let q = supabase
      .from("v_presence_visit_unified")
      .select(
        "snapshot_date, presence_for_sum, visit_seconds, region, city, market_id, team_leader_id",
        { count: "exact", head: false }
      )
      .eq("client_id", clientId)
      .gte("snapshot_date", dateFrom)
      .lte("snapshot_date", dateTo);

    if (selectedRegion) q = q.eq("region", selectedRegion);
    if (selectedCity) q = q.eq("city", selectedCity);
if (selectedMarketName) q = q.eq("store", selectedMarketName);

    if (selectedTeamLeader) q = q.eq("team_leader_id", selectedTeamLeader);

    const pageSize = 1000;
    let from = 0,
      to = pageSize - 1;
    let pres = 0,
      visit = 0;

    while (true) {
      const { data, error } = await q.range(from, to);
      if (error) {
        console.error("presence/visit fetch error", error);
        break;
      }
      const rows =
        (data ?? []) as Array<{
          presence_for_sum: number | null;
          visit_seconds: number | null;
        }>;

      for (const r of rows) {
        if (typeof r.presence_for_sum === "number") pres += r.presence_for_sum;
        if (typeof r.visit_seconds === "number") visit += r.visit_seconds;
      }

      if (!rows.length || rows.length < pageSize) break;
      from += pageSize;
      to += pageSize;
    }

    const transit = Math.max(0, pres - visit);
    setPresenceSeconds(pres);
    setVisitSeconds(visit);
    setTransitSeconds(transit);
}, [clientId, dateFrom, dateTo, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader]);

  /* ========= ربط الجلبات ========= */
  useEffect(() => {
    resolveClientAndDetails();
  }, [resolveClientAndDetails]);

  useEffect(() => {
  if (!clientId) return;
  fetchClientMarkets();
  fetchClientTeamLeaders();
  fetchAvailabilityStats();
  fetchVisitCards(); // ⬅️ إضافة
}, [clientId, fetchClientMarkets, fetchClientTeamLeaders, fetchAvailabilityStats, fetchVisitCards]);

  useEffect(() => {
    fetchPresenceVisitTransit();
  }, [fetchPresenceVisitTransit]);

  /* ========= إعادة الجلب عند التركيز ========= */
  useRefreshOnFocus(() => {
  resolveClientAndDetails();
  if (clientId) {
    fetchClientMarkets();
    fetchClientTeamLeaders();
    fetchPresenceVisitTransit();
    fetchVisitCards(); // ⬅️ إضافة
  }
});

  /* ========= Handlers ========= */
 const onFromChange = (v: string) => {
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
  const { isArabic: isAr } = useLangTheme();

  const clientDisplayName = useMemo(() => {
    const fallback = isAr ? "اسم الشركة" : "Company Name";
    if (!headerInfo) return client?.name || client?.name_ar || fallback;

    const fromView = isAr
      ? headerInfo.client_name_ar || headerInfo.client_name_en
      : headerInfo.client_name_en || headerInfo.client_name_ar;
    return fromView || client?.name || client?.name_ar || fallback;
  }, [headerInfo, client, isAr]);

  const clientLogoUrl = useMemo(
    () => toAvatarPublicUrl(headerInfo?.client_logo_filename || client?.logo_url),
    [headerInfo?.client_logo_filename, client?.logo_url]
  );

  // فلترة متسلسلة (Region → City)
  const filteredByRegion = useMemo(
    () => (selectedRegion ? allMarkets.filter((m) => m.region === selectedRegion) : allMarkets),
    [allMarkets, selectedRegion]
  );

  const filteredByCity = useMemo(
    () => (selectedCity ? filteredByRegion.filter((m) => m.city === selectedCity) : filteredByRegion),
    [filteredByRegion, selectedCity]
  );

  const regions = useMemo(() => {
    const s = new Set<string>();
    allMarkets.forEach((m) => {
      if (m.region) s.add(m.region);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ar"));
  }, [allMarkets]);

  const cities = useMemo(() => {
    const s = new Set<string>();
    filteredByRegion.forEach((m) => {
      if (m.city) s.add(m.city);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ar"));
  }, [filteredByRegion]);

  // أسواق مع id لعرضها في الـ select
 const marketOptions = useMemo(() => {
  // خُد الماركتس بعد فلترة المنطقة/المدينة
  const list = filteredByCity
    .filter((m): m is Required<Pick<MarketRow, "store">> & MarketRow => !!m.store)
    .map((m) => m.store!.trim());

  // إزالة التكرار حسب اسم المتجر فقط (Othaim يظهر مرة)
  const uniq = Array.from(new Set(list));
  return uniq.sort((a, b) => a.localeCompare(b, "ar"));
}, [filteredByCity]);

  /* ========= Data for stats ========= */
const orderedStats = useMemo(() => {
  // دوائر الوقت
  const presence = presenceSeconds;
  const visit = visitSeconds;
  const transit = transitSeconds;
  const visitPctTime   = presence ? (visit   / presence) * 100 : 0;
  const transitPctTime = presence ? (transit / presence) * 100 : 0;

  const base: Record<string, { value: number | string; percentage: number }> = {
    // 🔵 بطاقات الزيارات (من RPC)
    "Total Visits":      { value: totalVisits,      percentage: 100 },
    "Completed Visits":  { value: finishedVisits,   percentage: finishedPct },
    "False Visits":      { value: unfinishedVisits, percentage: unfinishedPct },
    "Completed %":       { value: finishedPct,      percentage: finishedPct },
    "False %":           { value: unfinishedPct,    percentage: unfinishedPct },

    // 🟢 بطاقات الإتاحة
    "Total Items":       { value: totalProducts,   percentage: 100 },
    "Total Available":   { value: totalAvailable,  percentage: totalProducts ? (totalAvailable / totalProducts) * 100 : 0 },
    "Not Available":     { value: totalUnavailable,percentage: totalProducts ? (totalUnavailable / totalProducts) * 100 : 0 },

    // 🟠 دوائر الوقت
    "Avg Visit Time":    { value: fmtHHMM(visit),   percentage: visitPctTime },
    "Total Travel Time": { value: fmtHHMM(transit), percentage: transitPctTime },
  };

  const top = ORDER_TOP.map((label) => ({ label, ...base[label] }));
  const bottom = ORDER_BOTTOM.map((label) => ({ label, ...base[label] }));
  return [...top, ...bottom];
}, [
  // زيارات
  totalVisits, finishedVisits, unfinishedVisits, finishedPct, unfinishedPct,
  // إتاحة
  totalProducts, totalAvailable, totalUnavailable,
  // وقت
  presenceSeconds, visitSeconds, transitSeconds
]);

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
          {isAr ? "جارٍ التحقق من الجلسة…" : "Checking session…"}
        </div>
      </div>
    );
  }

  if (!user) {
    return <p style={{ padding: "2rem" }}>Loading…</p>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* SubHeader — Responsive width */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
        <div
          style={{
            width: "min(1100px, 94vw)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            background: "var(--card)",
            border: "1px solid var(--divider)",
            borderRadius: 12,
            padding: "10px 14px",
          }}
        >
          {/* يسار: مرحبًا + لوجو */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            {clientLogoUrl ? (
              <Image
                src={clientLogoUrl}
                alt="Client Logo"
                width={36}
                height={36}
                style={{ borderRadius: 8, objectFit: "contain", cursor: "pointer" }}
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

            <div style={{ lineHeight: 1.25, minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {isAr ? "مرحبًا" : "Welcome"} {welcomeName}
              </div>
              {loadingClient && (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{isAr ? "جاري التحميل…" : "Loading…"}</div>
              )}
            </div>
          </div>

          {/* يمين: اسم الشركة كبير + زر تغيير كلمة المرور */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div
              title={clientDisplayName || ""}
              style={{
                fontWeight: 700,
                color: "var(--text)",
                maxWidth: "44vw",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "clamp(14px, 2.4vw, 20px)",
              }}
            >
              {clientDisplayName}
            </div>

            <button
              onClick={goChangePassword}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: "var(--card)",
                border: "1px solid var(--divider)",
                color: "var(--text)",
                fontSize: 13,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              🔒 {isAr ? "تغيير كلمة المرور" : "Change Password"}
            </button>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 12, marginBottom: 12 }}>
        <div className="filtersRow no-scrollbar">
          <div style={capsuleStyle}>
            <CapsuleItem label={isAr ? "المنطقة" : "Region"}>
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setSelectedCity("");
                 setSelectedMarketName("");
                }}
                style={capsuleSelect}
                disabled={loadingFilters}
              >
                <option value="">{isAr ? "الكل" : "All"}</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </CapsuleItem>

            <CapsuleItem label={isAr ? "المدينة" : "City"}>
              <select
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setSelectedMarketName("");
                }}
                style={capsuleSelect}
                disabled={loadingFilters || (regions.length > 0 && !selectedRegion && cities.length === 0)}
              >
                <option value="">{isAr ? "الكل" : "All"}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </CapsuleItem>

           <CapsuleItem label={isArabic ? "السوق" : "Market"}>
  <select
    value={selectedMarketName}
    onChange={(e) => setSelectedMarketName(e.target.value)}
    style={capsuleSelect}
    disabled={loadingFilters || marketOptions.length === 0}
  >
    <option value="">{isArabic ? "الكل" : "All"}</option>
    {marketOptions.map((name) => (
      <option key={name} value={name}>{name}</option>
    ))}
  </select>
</CapsuleItem>

            <CapsuleItem label={isAr ? "قائد الفريق" : "Team Leader"}>
              <select
                value={selectedTeamLeader}
                onChange={(e) => setSelectedTeamLeader(e.target.value)}
                style={capsuleSelect}
                disabled={loadingFilters}
              >
                <option value="">{isAr ? "الكل" : "All"}</option>
                {teamLeaders.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.username}
                  </option>
                ))}
              </select>
            </CapsuleItem>

            <CapsuleItem label={isAr ? "من" : "Date From"}>
              <input
                type="date"
                value={dateFrom}
               onChange={(e) => onFromChange(e.target.value)}
                onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
                style={capsuleInput}
              />
            </CapsuleItem>

            <CapsuleItem label={isAr ? "إلى" : "Date To"}>
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
      </div>

      <hr style={{ margin: "0 20px 20px", border: "none", borderTop: "1px solid var(--divider)" }} />

      {/* Stats rows */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 20, marginBottom: 20 }}>
        {orderedStats.slice(0, 5).map((stat, idx) => (
          <StatCard key={`top-${idx}`} stat={stat} isArabic={isAr} />
        ))}
      </div>

      <hr style={{ margin: "0 20px 20px", border: "none", borderTop: "1px solid var(--divider)" }} />

      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 20, marginBottom: 20 }}>
        {orderedStats.slice(5).map((stat, idx) => (
          <StatCard key={`bottom-${idx}`} stat={stat} isArabic={isAr} />
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", paddingBottom: 32 }}>
        <button style={primaryBtnStyle} onClick={() => router.push("/admin/notifications")}>
          {isAr ? "إرسال الإشعارات" : "Send Notifications"}
        </button>
       <button style={primaryBtnStyle} onClick={goToDetailedReports}>
  {isAr ? "التقارير المفصلة" : "Detailed Reports"}
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
                style={{ objectFit: "contain", margin: "20px 0" }}
              />
            )}
            <button onClick={() => setLogoModalOpen(false)} style={primaryBtnStyle}>
              {isAr ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .filtersRow {
          width: min(1100px, 94vw);
          display: flex;
          overflow-x: auto;
          padding: 6px 8px;
          scroll-snap-type: x mandatory;
        }
        .filtersRow > * {
          scroll-snap-align: start;
        }

        @media (min-width: 640px) {
          .filtersRow {
            overflow-x: visible;
          }
        }

        /* ✨ تصحيح ألوان option في الثيم الداكن */
        select option {
          color: #000;
          background: #fff;
        }

        .filtersRow select {
          color: var(--input-text);
          background-color: transparent;
        }
      `}</style>
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
  whiteSpace: "nowrap",
};

const itemShell: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  borderRadius: 9999,
  padding: "6px 10px",
  whiteSpace: "nowrap",
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
  backgroundColor: "transparent",
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

function CapsuleItem({ label, children }: { label: string; children: React.ReactNode }) {
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
    "False Visits": isArabic ? "الزيارات غير المكتملة" : "False Visits",
    "Completed %": isArabic ? "نسبة الزيارات المكتملة" : "Completed %",
    "False %": isArabic ? "نسبة الزيارات غير المكتملة" : "False %",
    "Total Available": isArabic ? "إجمالي المنتجات المتاحة" : "Total Available",
    "Not Available": isArabic ? "اجمالي المنتجات غير المتاحة" : "Not Available",
    "Avg Visit Time": isArabic ? "إجمالي وقت الزيارة" : "Avg Visit Time",
    "Total Travel Time": isArabic ? "إجمالي وقت التنقل" : "Total Travel Time",
    "Total Items": isArabic ? "إجمالي الأصناف" : "Total Items",
  };

  // أي بطاقة اسمها يحتوي على % نعرض فيها علامة %
  const isPercentCard = stat.label.includes("%");

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
      <div style={{ width: 110, height: 110, margin: "0 auto", display: "grid", placeItems: "center" }}>
        {isPercentCard ? (
          <CircularProgressbarWithChildren
            value={typeof stat.percentage === "number" ? stat.percentage : 0}
            styles={buildStyles({
              textColor: "var(--text)",
              pathColor: "var(--accent)",
              trailColor: "var(--chip-bg)",
            })}
          >
            <div style={{ lineHeight: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
                {typeof stat.value === "number" ? stat.value.toFixed(2) : stat.value}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>%</div>
            </div>
          </CircularProgressbarWithChildren>
        ) : (
          <CircularProgressbar
            value={typeof stat.percentage === "number" ? stat.percentage : 0}
            text={`${stat.value}`}
            styles={buildStyles({
              textColor: "var(--text)",
              pathColor: "var(--accent)",
              trailColor: "var(--chip-bg)",
            })}
          />
        )}
      </div>
      <p style={{ marginTop: 10, fontSize: 13 }}>{labels[stat.label] ?? stat.label}</p>
    </div>
  );
}


const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: "var(--card)",
  padding: "2rem",
  borderRadius: "12px",
  border: "1px solid var(--divider)",
  textAlign: "center",
  color: "var(--text)",
};
