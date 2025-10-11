"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useLangTheme } from "@/hooks/useLangTheme";

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

/* ========= Utils ========= */
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
    // نحسب فرق التوقيت بتوقيت الرياض
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
  const { isArabic: isAr, isDark } = useLangTheme();

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
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

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

    const isYMD = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s || "");
    const from = isYMD(fromDate) ? fromDate : null;
    const to = isYMD(toDate) ? toDate : null;

    let q = supabase
      .from("VisitRequests")
      .select(`
        id, user_id, market_id, daily_status, requested_at, log_date, visit_id,
        approved_by, approved_at, cancelled_by, cancelled_at, client_id
      `)
      .eq("client_id", clientId)
      .in("daily_status", ["approved", "rejected", "cancelled"])
      .order("requested_at", { ascending: false });

    if (from) q = q.gte("log_date", from);
    if (to) q = q.lte("log_date", to);

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
    const approverIds  = Array.from(new Set(base.map(r => r.approved_by).filter(Boolean))) as string[];
    const marketIds    = Array.from(new Set(base.map(r => r.market_id).filter(Boolean))) as string[];

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
    setFromDate("");
    setToDate("");
    if (tab === "history") fetchHistory(); else fetchPending();
  }, [fetchHistory, fetchPending, tab]);

  /* ==== filter lists ==== */
  const filteredPending = useMemo(() => {
    return pending.filter(r => {
      const okRegion = selectedRegion ? r.market?.region === selectedRegion : true;
      const okCity   = selectedCity ? r.market?.city === selectedCity : true;
      const okStore  = selectedStore ? r.market?.store === selectedStore : true;
      const okStatus = selectedStatus ? r.daily_status === selectedStatus : true;
      const okTL     = selectedTL ? r.requester?.team_leader_id === selectedTL : true;
      return okRegion && okCity && okStore && okStatus && okTL;
    });
  }, [pending, selectedRegion, selectedCity, selectedStore, selectedStatus, selectedTL]);

  const filteredHistory = useMemo(() => {
    return history.filter(r => {
      const okRegion = selectedRegion ? r.market?.region === selectedRegion : true;
      const okCity   = selectedCity ? r.market?.city === selectedCity : true;
      const okStore  = selectedStore ? r.market?.store === selectedStore : true;
      const okStatus = selectedStatus ? r.daily_status === selectedStatus : true;
      const okTL     = selectedTL ? r.requester?.team_leader_id === selectedTL : true;
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
              <ChipSelect
                value={selectedRegion}
                onChange={(e) => { setSelectedRegion(e.target.value); setSelectedCity(""); }}
                selected={!!selectedRegion}
                options={["", ...regions]}
                isDark={isDark}
              />
            </Chip>

            {/* City */}
            <Chip>
              <ChipLabel>{isAr ? "المدينة" : "City"}</ChipLabel>
              <ChipSelect
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                selected={!!selectedCity}
                disabled={!regions.length}
                options={["", ...cities]}
                isDark={isDark}
              />
            </Chip>

            {/* Store */}
            <Chip>
              <ChipLabel>{isAr ? "السوق" : "Store"}</ChipLabel>
              <ChipSelect
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                selected={!!selectedStore}
                options={["", ...stores]}
                isDark={isDark}
              />
            </Chip>

            {/* Status */}
            <Chip>
              <ChipLabel>{isAr ? "الحالة" : "Status"}</ChipLabel>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus((e.target.value || "") as typeof selectedStatus)}
                style={selectStyle(!!selectedStatus, isDark)}
              >
                <option value="">{isAr ? "الكل" : "All"}</option>
                <option value="pending">{isAr ? "معلّق" : "Pending"}</option>
                <option value="approved">{isAr ? "موافق" : "Approved"}</option>
                <option value="rejected">{isAr ? "مرفوض" : "Rejected"}</option>
                <option value="cancelled">{isAr ? "ملغى" : "Cancelled"}</option>
              </select>
            </Chip>

            {/* Team Leader */}
            <Chip>
              <ChipLabel>{isAr ? "التيم ليدر" : "Team Leader"}</ChipLabel>
              <select
                value={selectedTL}
                onChange={(e) => setSelectedTL(e.target.value)}
                style={selectStyle(!!selectedTL, isDark)}
              >
                <option value="">{isAr ? "الكل" : "All"}</option>
                {teamLeaders.map(tl => (
                  <option key={tl.id} value={tl.id}>{userDisplay(tl, isAr)}</option>
                ))}
              </select>
            </Chip>

            {/* From */}
            <Chip>
              <ChipLabel>{isAr ? "من" : "From"}</ChipLabel>
              <DateInput
                value={fromDate}
                onChange={(v) => {
                  setFromDate(v);
                  if (toDate && v && new Date(toDate) < new Date(v)) setToDate("");
                }}
                placeholder={isAr ? "اختر التاريخ" : "Pick date"}
                max={toDate || undefined}
              />
            </Chip>

            {/* To */}
            <Chip>
              <ChipLabel>{isAr ? "إلى" : "To"}</ChipLabel>
              <DateInput
                value={toDate}
                onChange={(v) => {
                  if (fromDate && v && new Date(v) < new Date(fromDate)) {
                    alert(isAr ? "تاريخ (إلى) لا يمكن أن يكون قبل (من)" : "End date cannot be before start date");
                    return;
                  }
                  setToDate(v);
                }}
                placeholder={isAr ? "اختر التاريخ" : "Pick date"}
                min={fromDate || undefined}
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
                          <button onClick={() => onApprove(r)} style={approveBtn} title={isAr ? "قبول الزيارة" : "Approve"}>
                            <span>✔</span> <span>{isAr ? "قبول" : "Approve"}</span>
                          </button>
                          <button onClick={() => onReject(r)} style={rejectBtn} title={isAr ? "رفض الزيارة" : "Reject"}>
                            <span>✖</span> <span>{isAr ? "رفض" : "Reject"}</span>
                          </button>
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

        /* 1) تأكيد أن عناصر القوائم المنسدلة نصّها أسود */
        select option { color: #000 !important; }

        /* خلفية العناصر داخل القائمة (فاتح/غامق) */
        html[data-theme="dark"] select option { background: #1b1b1b; }
        html[data-theme="light"] select option { background: #fff; }

        /* placeholder بديل لحقل التاريخ */
        .date-chip { position: relative; }
        .date-chip input::-webkit-calendar-picker-indicator { opacity: 0.8; }
        .date-chip .placeholder {
          position: absolute;
          inset-inline-start: 10px;
          top: 6px;
          font-size: 13px;
          color: var(--muted);
          pointer-events: none;
          user-select: none;
        }
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
function ChipSelect({
  value,
  onChange,
  selected,
  options,
  disabled,
  isDark,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  selected: boolean;
  options: string[];
  disabled?: boolean;
  isDark: boolean;
}) {
  // في الفاتح أو لو Disabled استخدم الـnative select
  if (!isDark || disabled) {
    return (
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={selectStyle(selected, false)}
        className="light-dropdown"
      >
        <option value="">{/* All */}الكل</option>
        {options.filter(Boolean).map(v => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    );
  }

  // في الداكن: منيو مخصّصة
  return <DarkSelect value={value} onValueChange={(val) => {
    const evt = { target: { value: val } } as unknown as React.ChangeEvent<HTMLSelectElement>;
    onChange(evt);
  }} selected={selected} options={options} disabled={!!disabled} />;
}

/* ====== Dark custom select (fully stylable) ====== */
function DarkSelect({
  value, onValueChange, selected, options, disabled,
}: {
  value: string;
  onValueChange: (v: string) => void;
  selected: boolean;
  options: string[];
  disabled: boolean;
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
  const label = (v: string) => (v === "" ? "الكل" : v);

  return (
    <div className="dark-select-wrap dark-select-reset dark-select-elev dark-select-scroll" style={{ position: "relative" }}>
      <button
        type="button"
        className="dark-select-trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        style={{
          background: selected ? "rgba(245,166,35,0.18)" : "transparent",
          color: "#fff",
          border: "none",
          outline: "none",
          fontSize: 13,
          borderRadius: 8,
          padding: "6px 28px 6px 10px",
          minWidth: 160,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {label(value)}
        <span style={{ position: "absolute", insetInlineEnd: 8, top: 6, opacity: .8 }}>▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          className="dark-select-pop"
          style={{
            position: "absolute",
            zIndex: 50,
            insetInlineStart: 0,
            marginTop: 6,
            minWidth: 180,
            maxHeight: 260,
            overflowY: "auto",
            background: "#101114",
            border: "1px solid #3a3d44",
            borderRadius: 10,
            boxShadow: "0 16px 40px rgba(0,0,0,.45)",
            padding: 6,
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
                  color: "#fff",
                  background: active
                    ? "rgba(245,166,35,.28)"
                    : hovered
                    ? "rgba(255,255,255,.06)"
                    : "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {label(opt)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


function DateInput({
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div className="date-chip" style={{ position: "relative" }}>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            (e.currentTarget as HTMLInputElement).showPicker?.();
            e.preventDefault();
          }
          // منع كتابة يدويًا باستثناء Tab
          if (e.key !== "Tab") e.preventDefault();
        }}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...dateChipInput, paddingRight: 10 }}
      />
      {!value && (
        <span className="placeholder">
          {placeholder || "Pick date"}
        </span>
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
const approveBtn: React.CSSProperties = {
  ...actionBtnBase,
  background: "rgba(0, 160, 60, 0.12)",
  borderColor: "rgba(0, 160, 60, 0.45)",
  boxShadow: "inset 0 0 0 1px rgba(0, 160, 60, 0.15)",
};
const rejectBtn: React.CSSProperties = {
  ...actionBtnBase,
  background: "rgba(200, 40, 40, 0.12)",
  borderColor: "rgba(200, 40, 40, 0.45)",
  boxShadow: "inset 0 0 0 1px rgba(200, 40, 40, 0.15)",
};
const dateChipInput: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  padding: "6px 28px 6px 10px",
  minWidth: 160,
  cursor: "pointer",
  appearance: "none",
  borderRadius: 8,
};
const selectStyle = (selected: boolean, isDark: boolean): React.CSSProperties => ({
  background: selected ? "rgba(245,166,35,0.18)" : "transparent",
  color: selected ? (isDark ? "#fff" : "#000") : "var(--text)",
  border: "none",
  outline: "none",
  fontSize: 13,
  borderRadius: 8,
  padding: "4px 8px",
  cursor: "pointer",
  appearance: "none",
});
