"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useLangTheme } from "@/hooks/useLangTheme";

// ======================= تعديل: إضافة مكتبة التاريخ وتنسيقاتها =======================
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
// =========================================================================

/* ========= Supabase ========= */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/* ========= Types ========= */
type Role = "admin" | "super_admin" | string;

type StoredUser = {
  id: string;
  username?: string;
  role?: Role;
  email?: string;
};

type Market = {
  id: string;
  store: string | null;
  city: string | null;
  region: string | null;
  branch: string | null;
};

type UserLite = {
  id: string;
  username: string | null;
  name: string | null;
  arabic_name: string | null;
  team_leader_id: string | null;
};

type VisitRequestRow = {
  id: string;
  user_id: string | null;
  market_id: string | null;
  daily_status: "pending" | "approved" | "rejected" | "cancelled";
  requested_at: string | null;
  log_date: string | null;
  visit_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  client_id: string | null;

  requester?: UserLite | null;
  approver?: UserLite | null;
  market?: Market | null;
};

// ======================= تعريف خيارات الحالة =======================
const STATUS_OPTIONS: { value: VisitRequestRow['daily_status'] | "", labelAr: string, labelEn: string }[] = [
    { value: "", labelAr: "الكل", labelEn: "All" },
    { value: "pending", labelAr: "معلّق", labelEn: "Pending" },
    { value: "approved", labelAr: "موافق", labelEn: "Approved" },
    { value: "rejected",  labelAr: "مرفوض",  labelEn: "Rejected" },
    { value: "cancelled", labelAr: "ملغى", labelEn: "Cancelled" },
];
// =================================================================

/* ========= Utils ========= */
function ksaDate(d: Date | null) {
  if (!d) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

function ksaDateTime(dt?: string | null) {
  if (!dt) return "";
  const d = new Date(dt);
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: "Asia/Riyadh",
    calendar: "gregory",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
function diffMinSec(a?: string | null, b?: string | null) {
  if (!a || !b) return "";
  try {
    const getKsaMs = (iso: string) => {
      const utc = new Date(iso).toLocaleString("en-US", { timeZone: "Asia/Riyadh" });
      return new Date(utc).getTime();
    };
    const ms = Math.max(0, getKsaMs(b) - getKsaMs(a));
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `min ${m}:${String(s).padStart(2, "0")}`;
  } catch {
    return "";
  }
}
function userDisplay(u?: Pick<UserLite, "username" | "name" | "arabic_name"> | null, isAr = false) {
  if (!u) return isAr ? "غير معروف" : "Unknown";
  const disp = (isAr ? u.arabic_name : u.name) || u.username;
  return disp || (isAr ? "غير معروف" : "Unknown");
}

/* ========= Local storage ========= */
const LS_KEYS = { currentUser: "currentUser", clientId: "client_id" } as const;
function readStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const ls = localStorage.getItem(LS_KEYS.currentUser) || sessionStorage.getItem(LS_KEYS.currentUser);
    return ls ? (JSON.parse(ls) as StoredUser) : null;
  } catch {
    return null;
  }
}
function readClientId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LS_KEYS.clientId);
  } catch {
    return null;
  }
}

/* ========= Page ========= */
export default function VisitRequestsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { isArabic: isAr } = useLangTheme();

  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  // tabs
  const initialTab = (params.get("tab") as "pending" | "history") || "pending";
  const [tab, setTab] = useState<"pending" | "history">(initialTab);

  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<VisitRequestRow[]>([]);
  const [history, setHistory] = useState<VisitRequestRow[]>([]);

  // date range (افتراضيًا فاضي = غير محدد)
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // Filters data
  const [regions, setRegions] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<UserLite[]>([]);

  // Selected filters
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"" | VisitRequestRow["daily_status"]>("");
  const [selectedTL, setSelectedTL] = useState("");

  /* ==== boot: session & role ==== */
  useEffect(() => {
    (async () => {
      const stored = readStoredUser();
      if (!stored?.id) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (!data?.session || error) {
        try {
          localStorage.removeItem(LS_KEYS.currentUser);
          sessionStorage.removeItem(LS_KEYS.currentUser);
        } catch {}
        router.replace("/login");
        return;
      }
      const role = String(stored.role || "").toLowerCase();
      if (role !== "admin" && role !== "super_admin" && role !== "team leader" && role !== "team_leader") {
        router.replace("/no-access");
        return;
      }
      setUser(stored);
      setClientId(readClientId());
      setBooting(false);
    })();
  }, [router]);

  /* ==== fetch Regions/Cities/Stores/TLs related to this client ==== */
  const hydrateFilters = useCallback(async () => {
    if (!clientId) return;

    // 1) ids of markets in this client's requests
    const { data: reqs } = await supabase.from("VisitRequests").select("market_id, user_id").eq("client_id", clientId);

    const marketIds = Array.from(new Set((reqs || []).map(r => r.market_id).filter(Boolean))) as string[];
    const requesterIds = Array.from(new Set((reqs || []).map(r => r.user_id).filter(Boolean))) as string[];

    // 2) markets -> regions/cities/stores
    if (marketIds.length) {
      const { data: mkts } = await supabase
        .from("Markets")
        .select("region,city,store")
        .in("id", marketIds);
      const rset = new Set<string>(), cset = new Set<string>(), sset = new Set<string>();
      (mkts || []).forEach(m => {
        if (m.region) rset.add(m.region);
        if (m.city) cset.add(m.city);
        if (m.store) sset.add(m.store);
      });
      setRegions(Array.from(rset).sort((a, b) => a.localeCompare(b, "ar")));
      setCities(Array.from(cset).sort((a, b) => a.localeCompare(b, "ar")));
      setStores(Array.from(sset).sort((a, b) => a.localeCompare(b, "ar")));
    } else {
      setRegions([]); setCities([]); setStores([]);
    }

    // 3) team leaders: من Users عبر team_leader_id للمرسلين
    if (requesterIds.length) {
      const { data: users } = await supabase
        .from("Users")
        .select("id, team_leader_id")
        .in("id", requesterIds);

      const tlIds = Array.from(new Set((users || []).map(u => u.team_leader_id).filter(Boolean))) as string[];

      if (tlIds.length) {
        const { data: tls } = await supabase
          .from("Users")
          .select("id, username, name, arabic_name, team_leader_id")
          .in("id", tlIds);
        setTeamLeaders((tls || []) as UserLite[]);
      } else {
        setTeamLeaders([]);
      }
    } else {
      setTeamLeaders([]);
    }
  }, [clientId]);

  /* ==== fetch Pending with joins ==== */
  const fetchPending = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("VisitRequests")
      .select(`
        id, user_id, market_id, daily_status, requested_at, log_date, visit_id,
        approved_by, approved_at, cancelled_by, cancelled_at, client_id,
        requester:Users!VisitRequests_user_id_fkey(id, username, name, arabic_name, team_leader_id),
        approver:Users!VisitRequests_approved_by_fkey(id, username, name, arabic_name, team_leader_id),
        market:Markets!VisitRequests_market_id_fkey(id, store, city, region, branch)
      `)
      .eq("client_id", clientId)
      .eq("daily_status", "pending")
      .order("requested_at", { ascending: false })
      .returns<VisitRequestRow[]>();

    if (error) {
      console.error("fetchPending error", error);
      setPending([]);
    } else {
      setPending(data || []);
    }
    setLoading(false);
  }, [clientId]);

  /* ==== fetch History (approved/rejected/cancelled) ==== */
  const fetchHistory = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    // تطبيق منطق "الفترة المفتوحة"
    const from_str = fromDate ? ksaDate(fromDate) : "1970-01-01";
    const to_str = toDate ? ksaDate(toDate) : "2999-12-31";

    let q = supabase
      .from("VisitRequests")
      .select(`
        id, user_id, market_id, daily_status, requested_at, log_date, visit_id,
        approved_by, approved_at, cancelled_by, cancelled_at, client_id
      `)
      .eq("client_id", clientId)
      .in("daily_status", ["approved", "rejected", "cancelled"])
      .order("requested_at", { ascending: false });

    // استخدام النطاق الواسع بدلاً من التحقق من الـ null
    q = q.gte("log_date", from_str);
    q = q.lte("log_date", to_str);

    const { data: rows, error } = await q;
    if (error) {
      console.error("fetchHistory base error:", error);
      setHistory([]);
      setLoading(false);
      return;
    }
    const base = rows || [];
    if (!base.length) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const requesterIds = Array.from(new Set(base.map(r => r.user_id).filter(Boolean))) as string[];
    const approverIds  = Array.from(new Set(base.map(r => r.approved_by).filter(Boolean))) as string[];
    const marketIds    = Array.from(new Set(base.map(r => r.market_id).filter(Boolean))) as string[];

    const [{ data: reqUsers }, { data: appUsers }, { data: mkts }] = await Promise.all([
      requesterIds.length
        ? supabase.from("Users").select("id, username, name, arabic_name, team_leader_id").in("id", requesterIds)
        : Promise.resolve({ data: [] as UserLite[] }),
      approverIds.length
        ? supabase.from("Users").select("id, username, name, arabic_name, team_leader_id").in("id", approverIds)
        : Promise.resolve({ data: [] as UserLite[] }),
      marketIds.length
        ? supabase.from("Markets").select("id, store, city, region, branch").in("id", marketIds)
        : Promise.resolve({ data: [] as Market[] }),
    ]);

    const reqMap = new Map<string, UserLite>();
    (reqUsers || []).forEach(u => reqMap.set(u.id, u as UserLite));
    const appMap = new Map<string, UserLite>();
    (appUsers || []).forEach(u => appMap.set(u.id, u as UserLite));
    const mktMap = new Map<string, Market>();
    (mkts || []).forEach(m => mktMap.set(m.id, m as Market));

    const hydrated: VisitRequestRow[] = base.map(r => ({
      ...r,
      requester: r.user_id ? reqMap.get(r.user_id) || null : null,
      approver: r.approved_by ? appMap.get(r.approved_by) || null : null,
      market: r.market_id ? mktMap.get(r.market_id) || null : null,
    }));

    setHistory(hydrated);
    setLoading(false);
  }, [clientId, fromDate, toDate]);

  useEffect(() => {
    if (!clientId || booting) return;
    hydrateFilters();
  }, [clientId, booting, hydrateFilters]);

  useEffect(() => {
    if (booting || !clientId) return;
    if (tab === "pending") fetchPending();
    else fetchHistory();
  }, [booting, clientId, tab, fetchPending, fetchHistory]);

  /* ==== actions ==== */
  const onApprove = useCallback(
    async (vr: VisitRequestRow) => {
      if (!user) return;
      setPending(p => p.filter(r => r.id !== vr.id));
      const { error } = await supabase
        .from("VisitRequests")
        .update({
          daily_status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", vr.id)
        .eq("daily_status", "pending");
      if (error) {
        console.error("approve error", error);
        fetchPending();
      }
    },
    [user, fetchPending]
  );

  const onReject = useCallback(
    async (vr: VisitRequestRow) => {
      if (!user) return;
      setPending(p => p.filter(r => r.id !== vr.id));
      const { error } = await supabase
        .from("VisitRequests")
        .update({
          daily_status: "rejected",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", vr.id)
        .eq("daily_status", "pending");
      if (error) {
        console.error("reject error", error);
        fetchPending();
      }
    },
    [user, fetchPending]
  );

  const resetFilters = useCallback(() => {
    setSelectedRegion("");
    setSelectedCity("");
    setSelectedStore("");
    setSelectedStatus("");
    setSelectedTL("");
    setFromDate(null);
    setToDate(null);
    if (tab === "history") fetchHistory(); else fetchPending();
  }, [fetchHistory, fetchPending, tab]);

  const handleDateFromChange = (date: Date | null) => {
    setFromDate(date);
    if (toDate && date && date > toDate) {
      setToDate(null);
    }
  };
  
  const handleDateToChange = (date: Date | null) => {
    if (fromDate && date && date < fromDate) {
      return; 
    }
    setToDate(date);
  };


  /* ==== filter lists ==== */
  const filteredPending = useMemo(() => {
    return pending.filter(r => {
      const okRegion = selectedRegion ? r.market?.region === selectedRegion : true;
      const okCity   = selectedCity ? r.market?.city === selectedCity : true;
      const okStore  = selectedStore ? r.market?.store === selectedStore : true;
      const okStatus = selectedStatus ? r.daily_status === selectedStatus : true;
      const okTL     = selectedTL ? r.requester?.team_leader_id === selectedTL : true;
      return okRegion && okCity && okStore && okStatus && okTL;
    });
  }, [pending, selectedRegion, selectedCity, selectedStore, selectedStatus, selectedTL]);

  const filteredHistory = useMemo(() => {
    return history.filter(r => {
      const okRegion = selectedRegion ? r.market?.region === selectedRegion : true;
      const okCity   = selectedCity ? r.market?.city === selectedCity : true;
      const okStore  = selectedStore ? r.market?.store === selectedStore : true;
      const okStatus = selectedStatus ? r.daily_status === selectedStatus : true;
      const okTL     = selectedTL ? r.requester?.team_leader_id === selectedTL : true;
      return okRegion && okCity && okStore && okStatus && okTL;
    });
  }, [history, selectedRegion, selectedCity, selectedStore, selectedStatus, selectedTL]);

  /* ==== Cells ==== */
  const MarketCell = ({ m }: { m?: Market | null }) => (
    <div style={{ lineHeight: 1.2, textAlign: "center" }}>
      <div style={{ fontWeight: 800 }}>{m?.store || (isAr ? "غير محدد" : "Unknown")}</div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        {m?.region || "-"} · {m?.city || "-"}
      </div>
      {m?.branch ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {isAr ? "الفرع" : "Branch"}: {m.branch}
        </div>
      ) : null}
    </div>
  );
  const UserCell = ({ u, label }: { u?: UserLite | null; label?: string }) => (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontWeight: 800 }}>{userDisplay(u || null, isAr)}</div>
      {label ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div> : null}
    </div>
  );

  if (booting) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        {isAr ? "جاري التحقق من الجلسة…" : "Checking session…"}
      </div>
    );
  }

const DASH_HOME = process.env.NEXT_PUBLIC_DASH_HOME || "/admin/dashboard";
  return (
    <div style={{ minHeight: "100vh", padding: "16px 0", color: "var(--text)" }}>
      {/* Header & Filters */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: "min(1200px, 95vw)",
            background: "var(--card)",
            border: "1px solid var(--divider)",
            borderRadius: 16,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginInlineStart: "auto" }}>
              {isAr ? "طلبات الزيارة" : "Visit Requests"}
            </div>

            {/* Region */}
            <Chip>
              <ChipLabel>{isAr ? "المنطقة" : "Region"}</ChipLabel>
              <DarkSelect
                value={selectedRegion}
                onValueChange={(v) => { setSelectedRegion(v); setSelectedCity(""); }}
                selected={!!selectedRegion}
                options={regions}
                disabled={!regions.length}
                isAr={isAr}
              />
            </Chip>

            {/* City */}
            <Chip>
              <ChipLabel>{isAr ? "المدينة" : "City"}</ChipLabel>
              <DarkSelect
                value={selectedCity}
                onValueChange={(v) => setSelectedCity(v)}
                selected={!!selectedCity}
                options={cities}
                disabled={!regions.length}
                isAr={isAr}
              />
            </Chip>

            {/* Store */}
            <Chip>
              <ChipLabel>{isAr ? "السوق" : "Store"}</ChipLabel>
              <DarkSelect
                value={selectedStore}
                onValueChange={setSelectedStore}
                selected={!!selectedStore}
                options={stores}
                disabled={!stores.length}
                isAr={isAr}
              />
            </Chip>

            {/* Status */}
            <Chip>
              <ChipLabel>{isAr ? "الحالة" : "Status"}</ChipLabel>
              <DarkSelect
                value={selectedStatus}
                onValueChange={(v) => setSelectedStatus((v || "") as typeof selectedStatus)}
                selected={!!selectedStatus}
                options={STATUS_OPTIONS.map(o => o.value).filter(Boolean)}
                isAr={isAr}
                getLabel={(v) => {
                    const option = STATUS_OPTIONS.find(o => o.value === v);
                    return isAr ? option?.labelAr : option?.labelEn;
                }}
              />
            </Chip>

            {/* Team Leader */}
            <Chip>
              <ChipLabel>{isAr ? "التيم ليدر" : "Team Leader"}</ChipLabel>
              <DarkSelect
                value={selectedTL}
                onValueChange={setSelectedTL}
                selected={!!selectedTL}
                options={teamLeaders.map(tl => tl.id)}
                isAr={isAr}
                getLabel={(id) => {
                    const tl = teamLeaders.find(u => u.id === id);
                    return userDisplay(tl, isAr);
                }}
              />
            </Chip>

            {/* From */}
            <Chip>
              <ChipLabel>{isAr ? "من" : "From"}</ChipLabel>
              <DatePicker
                  selected={fromDate}
                  onChange={handleDateFromChange}
                  selectsStart
                  endDate={toDate}
                  dateFormat="yyyy/MM/dd"
                  placeholderText={isAr ? "اختر التاريخ" : "Pick date"}
                  className="date-picker-input"
              />
            </Chip>

            {/* To */}
            <Chip>
              <ChipLabel>{isAr ? "إلى" : "To"}</ChipLabel>
              <DatePicker
                  selected={toDate}
                  onChange={handleDateToChange}
                  selectsEnd
                  minDate={fromDate ?? undefined} 
                  dateFormat="yyyy/MM/dd"
                  placeholderText={isAr ? "اختر التاريخ" : "Pick date"}
                  className="date-picker-input"
              />
            </Chip>

            <button onClick={() => (tab === "history" ? fetchHistory() : fetchPending())} style={secondaryBtn}>
              {isAr ? "تحديث" : "Refresh"}
            </button>

            <button onClick={resetFilters} style={{ ...secondaryBtn, background: "transparent" }}>
              {isAr ? "مسح الفلاتر" : "Reset"}
            </button>

            <button
              onClick={() => router.push(DASH_HOME)}
              style={{ ...secondaryBtn, background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {isAr ? "رجوع" : "Back"}
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setTab("pending")} style={{ ...tabBtn, ...(tab === "pending" ? tabBtnActive : null) }}>
              {isAr ? "المعلّقة الآن" : "Pending"}
            </button>
            <button onClick={() => setTab("history")} style={{ ...tabBtn, ...(tab === "history" ? tabBtnActive : null) }}>
              {isAr ? "سجلّ الطلبات" : "History"}
            </button>
            <div style={{ marginInlineStart: "auto", alignSelf: "center", fontSize: 12, color: "var(--muted)" }}>
              {loading ? (isAr ? "تحميل…" : "Loading…") : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
        <div
          style={{
            width: "min(1200px, 95vw)",
            background: "var(--card)",
            border: "1px solid var(--divider)",
            borderRadius: 16,
            overflowX: "auto",
          }}
          className="no-scrollbar"
        >
          {tab === "pending" ? (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th>{isAr ? "اسم الفرع" : "Market"}</th>
                  <th>{isAr ? "المرسِل" : "Requester"}</th>
                  <th>{isAr ? "وقت الطلب" : "Requested At"}</th>
                  <th>{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>
                      {isAr ? "لا توجد طلبات معلّقة" : "No pending requests"}
                    </td>
                  </tr>
                ) : (
                  filteredPending.map(r => (
                    <tr key={r.id} style={rowStyle}>
                      <td><MarketCell m={r.market} /></td>
                      <td><UserCell u={r.requester} /></td>
                      <td>{ksaDateTime(r.requested_at)}</td>
                      <td>
                        <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
                          {/* ======================= تعديل: شكل زر القبول (احترافي) ======================= */}
                          <button onClick={() => onApprove(r)} style={approveBtn} title={isAr ? "قبول الزيارة" : "Approve"}>
                            <span style={{ fontSize: 14 }}>✔</span> <span>{isAr ? "قبول" : "Approve"}</span>
                          </button>
                          {/* ===================================================================== */}
                          {/* ======================= تعديل: شكل زر الرفض (احترافي) ======================= */}
                          <button onClick={() => onReject(r)} style={rejectBtn} title={isAr ? "رفض الزيارة" : "Reject"}>
                            <span style={{ fontSize: 14 }}>✖</span> <span>{isAr ? "رفض" : "Reject"}</span>
                          </button>
                          {/* =================================================================== */}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th>{isAr ? "اسم الفرع" : "Market"}</th>
                  <th>{isAr ? "المرسِل" : "Requester"}</th>
                  <th>{isAr ? "وقت الطلب" : "Requested At"}</th>
                  <th>{isAr ? "الإجراء" : "Action"}</th>
                  <th>{isAr ? "المنفّذ" : "By"}</th>
                  <th>{isAr ? "وقت الإجراء" : "Action Time"}</th>
                  <th>{isAr ? "الوقت حتى الموافقة" : "Duration"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>
                      {isAr ? "لا توجد سجلات" : "No records"}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map(r => {
                    const isApproved = r.daily_status === "approved";
                    const isRejected = r.daily_status === "rejected";
                    const actionBy = isApproved || isRejected ? r.approver : r.requester; // cancelled => requester
                    const actionTime = isApproved || isRejected ? r.approved_at : r.cancelled_at;

                    const actionLabel =
                      isApproved ? (isAr ? "موافقة" : "Approved")
                        : isRejected ? (isAr ? "رفض" : "Rejected")
                        : (isAr ? "إلغاء" : "Cancelled");

                    return (
                      <tr key={r.id} style={rowStyle}>
                        <td><MarketCell m={r.market} /></td>
                        <td><UserCell u={r.requester} /></td>
                        <td>{ksaDateTime(r.requested_at)}</td>
                        <td>{actionLabel}</td>
                        <td><UserCell u={actionBy || undefined} /></td>
                        <td>{ksaDateTime(actionTime)}</td>
                        <td>{diffMinSec(r.requested_at, actionTime)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* ============================================== */
        /* === تنسيقات DatePicker الموحدة (من Dashboard) === */
        /* ============================================== */
        .date-picker-input {
            background: transparent;
            border: none;
            color: var(--text);
            font-size: 13px;
            outline: none;
            padding: 6px 28px 6px 10px;
            min-width: 160px;
            cursor: pointer;
            appearance: none;
            border-radius: 8px;
            text-align: inherit;
        }
        .date-picker-input::placeholder {
            color: var(--muted);
        }
        .react-datepicker-popper { z-index: 55; }
        .react-datepicker { border: 1px solid var(--divider); background: var(--card); }
        .react-datepicker__header { background-color: var(--card) !important; border-bottom: 1px solid var(--divider); }
        .react-datepicker__current-month, .react-datepicker__day-name, .react-datepicker__day { color: var(--text) !important; }
        .react-datepicker__day--selected, .react-datepicker__day--in-selecting-range, .react-datepicker__day--in-range { background-color: var(--accent) !important; color: var(--accent-foreground) !important; border-radius: 0.3rem; }
        .react-datepicker__day--keyboard-selected { background-color: var(--accent) !important; color: var(--accent-foreground) !important; }
        .react-datepicker__day:hover { background-color: rgba(255,255,255,0.1) !important; }
        .react-datepicker__day--disabled { opacity: 0.4; }
        /* ============================================== */
        /* === تنسيقات Dark Select / Selects العامة === */
        /* ============================================== */

        .dark-select-scroll {
             -ms-overflow-style: none;
             scrollbar-width: none;
        }
        .dark-select-scroll::-webkit-scrollbar { display: none; }

         .dark-select-pop {
            background: var(--card) !important; 
            border: 1px solid var(--divider) !important;
            box-shadow: 0 16px 40px rgba(0,0,0,.6) !important;
        }
        .dark-select-pop li { color: var(--text) !important; }
        .dark-select-pop li[aria-selected="true"] { 
            background: color-mix(in oklab, var(--accent) 30%, transparent) !important;
            color: var(--accent-foreground) !important;
        }
        .dark-select-pop li:hover { background: rgba(255, 255, 255, 0.08) !important; }
        .dark-select-pop li[aria-selected="true"]:hover {
            background: color-mix(in oklab, var(--accent) 40%, transparent) !important;
        }

        select option { color: #000 !important; background: #fff !important; }
        select option:nth-child(even) { background: #f0f0f0 !important; }
      `}</style>
    </div>
  );
}

/* ========= micro UI helpers ========= */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      background: "var(--card)",
      border: "1px solid var(--divider)",
      borderRadius: 9999,
      padding: "6px 10px",
    }}>
      {children}
    </div>
  );
}
function ChipLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 12, color: "var(--muted)" }}>{children}</span>;
}

/* ====== Dark custom select (fully stylable) ====== */
function DarkSelect({
  value, onValueChange, selected, options, disabled, isAr, getLabel,
}: {
  value: string;
  onValueChange: (v: string) => void;
  selected: boolean;
  options: string[];
  disabled?: boolean;
  isAr: boolean;
  getLabel?: (v: string) => string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number>(() => {
    const idx = ["", ...options.filter(Boolean)].indexOf(value);
    return Math.max(0, idx);
  });

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!(e.target as HTMLElement)?.closest?.(".dark-select-wrap")) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const items = useMemo(() => ["", ...options.filter(Boolean)], [options]);
  
  // دالة عرض النص: تستخدم getLabel الممررة أو القيمة الأصلية كإجراء احتياطي
  const displayLabel = (v: string) => {
    if (v === "") return isAr ? "الكل" : "All";
    return getLabel ? getLabel(v) || v : v;
  };

  return (
    <div className="dark-select-wrap dark-select-scroll" style={{ position: "relative" }}>
      <button
        type="button"
        className="dark-select-trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        style={{
          background: selected ? "rgba(245,166,35,0.18)" : "transparent",
          color: "var(--text)",
          border: "none",
          outline: "none",
          fontSize: 13,
          borderRadius: 8,
          padding: "6px 28px 6px 10px",
          minWidth: 160,
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: isAr ? 'right' : 'left',
        }}
      >
        {displayLabel(value)}
        <span style={{ position: "absolute", insetInlineEnd: 8, top: 6, opacity: .8 }}>▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          className="dark-select-pop dark-select-scroll"
          style={{
            position: "absolute",
            zIndex: 50,
            insetInlineStart: 0,
            marginTop: 6,
            minWidth: 180,
            maxHeight: 260,
            overflowY: "auto",
            transform: isAr ? 'translateX(calc(-100% + 160px))' : 'none', 
            background: "var(--card)",
            border: "1px solid var(--divider)",
            borderRadius: 10,
            boxShadow: "0 16px 40px rgba(0,0,0,.45)",
            padding: 6,
            direction: isAr ? 'rtl' : 'ltr',
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown") setHoverIdx(i => Math.min(items.length - 1, i + 1));
            if (e.key === "ArrowUp") setHoverIdx(i => Math.max(0, i - 1));
            if (e.key === "Enter" || e.key === " ") {
              onValueChange(items[hoverIdx]);
              setOpen(false);
            }
          }}
        >
          {items.map((opt, i) => {
            const active = opt === value;
            const hovered = i === hoverIdx;
            return (
              <li
                key={opt || "__all__"}
                role="option"
                aria-selected={active}
                className="dark-select-item"
                onMouseEnter={() => setHoverIdx(i)}
                onClick={() => { onValueChange(opt); setOpen(false); }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  color: "var(--text)",
                  background: active
                    ? "rgba(245,166,35,0.28)"
                    : hovered
                    ? "rgba(255,255,255,.06)"
                    : "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: isAr ? 'right' : 'left',
                }}
              >
                {displayLabel(opt)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


/* ========= styles ========= */
const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  textAlign: "center",
};
const rowStyle: React.CSSProperties = {
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
};
const tabBtn: React.CSSProperties = {
  background: "var(--card)",
  borderStyle: "solid",
  borderWidth: 1,
  borderColor: "var(--divider)",
  color: "var(--text)",
  borderRadius: 9999,
  padding: "8px 14px",
  fontWeight: 700,
  cursor: "pointer",
};
const tabBtnActive: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  borderColor: "transparent",
};
const secondaryBtn: React.CSSProperties = {
  background: "var(--input-bg)",
  color: "var(--text)",
  border: "1px solid var(--input-border)",
  borderRadius: 10,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};
const actionBtnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 12,
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
  borderWidth: 1,
  borderStyle: "solid",
  transition: "transform .06s ease, box-shadow .15s ease, background .15s ease",
};

// ======================= تعديل: تصميم زر القبول (احترافي) =======================
const approveBtn: React.CSSProperties = {
  ...actionBtnBase,
  background: "color-mix(in oklab, #00A03C 15%, transparent)", // أخضر خفيف
  borderColor: "#00A03C", // أخضر غامق
  color: "#00A03C", // نص أخضر
  padding: "6px 10px", // تصغير الحجم
  fontSize: 13,
};
// ===============================================================================

// ======================= تعديل: تصميم زر الرفض (احترافي) =======================
const rejectBtn: React.CSSProperties = {
  ...actionBtnBase,
  background: "color-mix(in oklab, #DC143C 15%, transparent)", // أحمر خفيف
  borderColor: "#DC143C", // أحمر غامق
  color: "#DC143C", // نص أحمر
  padding: "6px 10px", // تصغير الحجم
  fontSize: 13,
};
// ===============================================================================