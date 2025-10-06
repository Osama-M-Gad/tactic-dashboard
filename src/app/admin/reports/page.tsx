"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useLangTheme } from "@/hooks/useLangTheme";
import StepsToolbar from "@/app/admin/visit-steps/StepsToolbar";
import StepDataTable from "@/app/admin/visit-steps/StepDataTable";
import { VISIT_STEPS, StepKey } from "@/utils/visitStepsMap";

/* ========= Supabase ========= */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/* ========= Types ========= */
type UUID = string;

type UserRow = {
  id: UUID;
  name: string | null;
  username: string | null;
  arabic_name: string | null;
  role: string | null;
  team_leader_id: UUID | null;
};

type MarketRow = {
  id: UUID;
  name: string;
  region?: string | null;
  city?: string | null;
  store?: string | null;
  branches?: string | null;
};

type SnapshotRow = {
  id: UUID;
  original_visit_id: UUID | null;
  tl_visit_id: UUID | null;
  coordinator_visit_id: UUID | null;
  user_id: UUID;
  market_id: UUID;
  client_id: UUID | null;
  snapshot_date: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
};

/* ========= Helpers ========= */
const LS_KEYS = { clientId: "client_id" } as const;
const getClientId = () => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LS_KEYS.clientId) || sessionStorage.getItem(LS_KEYS.clientId);
  } catch {
    return null;
  }
};

const isAdminRole = (role?: string | null) => {
  const r = (role || "").toLowerCase().trim();
  return r === "admin" || r === "super_admin" || r === "super admin";
};
const isTLRole = (role?: string | null) =>
  (role || "").toLowerCase().includes("team_leader") ||
  (role || "").toLowerCase().includes("team leader");

const roleLabel = (role: string | null, ar: boolean) => {
  const r = (role || "").toLowerCase();
  if (r === "mch") return ar ? "منسق" : "Merchandiser";
  if (r === "promoter" || r === "promoplus") return ar ? "مروج" : "Promoter";
  if (r.includes("team_leader")) return ar ? "قائد فريق" : "Team Leader";
  return role || "—";
};

const cardBorder = "1px solid var(--divider)";

/* ========= Reusable UI ========= */
function PillCount({ n }: { n: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 24,
        padding: "2px 8px",
        borderRadius: 999,
        border: cardBorder,
        background: "var(--card)",
        color: "var(--muted, #aaa)",
        fontSize: 12,
      }}
    >
      {n}
    </span>
  );
}
function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ border: cardBorder, background: "var(--card)", borderRadius: 16, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, opacity: 0.9 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}
function EmptyBox({ text }: { text: string }) {
  return (
    <div
      style={{
        border: cardBorder,
        background: "var(--input-bg)",
        borderRadius: 12,
        padding: 24,
        textAlign: "center",
        fontSize: 13,
        opacity: 0.85,
      }}
    >
      {text}
    </div>
  );
}

/* ============ Filters / Capsules ============ */
function Capsule({ label, summary, children }: { label: string; summary?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        border: "1px solid var(--input-border)",
        borderRadius: 14,
        background: "var(--input-bg)",
        padding: "8px 10px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "var(--muted, #aaa)" }}>{label}</div>
        {summary && <div style={{ fontSize: 11, opacity: 0.75 }}>{summary}</div>}
      </div>
      {children}
    </div>
  );
}

/* بسيط: dropdown multi-select */
function MultiDropdown({
  options,
  values,
  onChange,
  placeholder,
}: {
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((s) => !s);
  const { isArabic: ar } = useLangTheme();

  const selectedText =
    values.length === 0
      ? placeholder || (ar ? "الكل" : "All")
      : values.slice(0, 2).join(", ") + (values.length > 2 ? " +" + (values.length - 2) : "");

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={toggle}
        style={{
          width: "100%",
          textAlign: "start",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid var(--input-border)",
          background: "var(--card)",
          color: "var(--text)",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        {selectedText}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            insetInlineStart: 0,
            marginTop: 6,
            zIndex: 50,
            minWidth: "100%",
            maxHeight: 240,
            overflow: "auto",
            borderRadius: 12,
            border: cardBorder,
            background: "var(--card)",
            padding: 8,
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: 8, opacity: 0.7, fontSize: 12 }}>{ar ? "لا يوجد" : "No options"}</div>
          ) : (
            options.map((op) => {
              const checked = values.includes(op);
              return (
                <label key={op} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => (checked ? onChange(values.filter((v) => v !== op)) : onChange([...values, op]))}
                  />
                  <span>{op}</span>
                </label>
              );
            })
          )}
          <div style={{ display: "flex", gap: 8, padding: 8 }}>
            <button type="button" onClick={() => onChange([])} style={{ ...btnSm(false), padding: "6px 12px" }}>
              {ar ? "مسح" : "Clear"}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={{ ...btnSm(true), padding: "6px 12px" }}>
              {ar ? "تم" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  locale = "en-GB",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  locale?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pretty = useMemo(() => {
    if (!value) return "—";
    const d = new Date(value + "T00:00:00");
    if (Number.isNaN(+d)) return value;
    return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  }, [value, locale]);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if ("showPicker" in el && typeof (el as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
      (el as HTMLInputElement & { showPicker: () => void }).showPicker();
    } else {
      el.click();
      el.focus();
    }
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: "var(--muted, #aaa)" }}>{label}</div>

      <div
        role="button"
        onClick={openPicker}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPicker()}
        tabIndex={0}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid var(--input-border)",
          background: "var(--card)",
          cursor: "pointer",
          userSelect: "none",
        }}
        className="datefield"
      >
        <span style={{ fontWeight: 700 }}>{pretty}</span>
        <span aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
            <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 3v4M8 3v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
      />
    </div>
  );
}

/* ========= Page ========= */
export default function Page() {
  const { isArabic: ar } = useLangTheme();
  const search = useSearchParams();

  const [loading, setLoading] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    clientId: "",
    from: "",
    to: "",
    regions: [] as string[],
    cities: [] as string[],
    marketsNames: [] as string[],
    teamLeaderId: null as UUID | "ALL" | null,
  });

  // TLs/users/markets
  const [tls, setTls] = useState<UserRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [markets, setMarkets] = useState<MarketRow[]>([]);

  // options
  const [regionsOpts, setRegionsOpts] = useState<string[]>([]);
  const [citiesOpts, setCitiesOpts] = useState<string[]>([]);
  const [marketsOpts, setMarketsOpts] = useState<string[]>([]);

  // selections
  const [selectedUsers, setSelectedUsers] = useState<UUID[]>([]);
  const [selectedChains, setSelectedChains] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<UUID[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<UUID[]>([]);

  // الخطوة الافتراضية + الاختيار
  const FIRST_STEP: StepKey = useMemo(() => Object.keys(VISIT_STEPS)[0] as StepKey, []);
  const [currentStep, setCurrentStep] = useState<StepKey>(FIRST_STEP);

  // الزيارة المختارة
  const activeVisitId = useMemo(() => {
    if (selectedSnapshotIds.length === 0) return null;
    const sid = selectedSnapshotIds[0];
    const s = snapshots.find((x) => x.id === sid);
    return s ? (s.original_visit_id || s.tl_visit_id || null) : null;
  }, [selectedSnapshotIds, snapshots]);

  // إظهار فقط خطوات الزيارة اللي فيها بيانات
  const [availableSteps, setAvailableSteps] = useState<StepKey[]>([]);
  useEffect(() => {
    if (!activeVisitId) {
      setAvailableSteps([]);
      return;
    }
    let alive = true;
    (async () => {
      const checks = await Promise.all(
        (Object.keys(VISIT_STEPS) as StepKey[]).map(async (k) => {
          const cfg = VISIT_STEPS[k];
          const { count, error } = await supabase
            .from(cfg.table)
            .select("id", { count: "exact", head: true })
            .eq("visit_id", activeVisitId);
          if (error) return [k, 0] as const;
          return [k, count || 0] as const;
        })
      );
      if (!alive) return;
      const keys = checks.filter(([, c]) => c > 0).map(([k]) => k as StepKey);
      setAvailableSteps(keys);
      setCurrentStep((prev) => (keys.includes(prev) ? prev : (keys[0] ?? FIRST_STEP)));
    })();
    return () => {
      alive = false;
    };
  }, [activeVisitId, FIRST_STEP]);

  // رجّع لأول خطوة لما التاريخ يتغير
  useEffect(() => {
    setCurrentStep(FIRST_STEP);
  }, [FIRST_STEP, selectedSnapshotIds]);

  /* ====== init: clientId + query ====== */
  useEffect(() => {
    const cid = getClientId();
    setFilters((s) => ({ ...s, clientId: cid || s.clientId }));

    if (!search) return;
    const from = search.get("from");
    const to = search.get("to");
    const tl = search.get("tl") as UUID | "ALL" | null;
    setFilters((s) => ({ ...s, from: from || s.from, to: to || s.to, teamLeaderId: tl ?? s.teamLeaderId }));
  }, [search]);

  /* ====== TLs for client ====== */
  useEffect(() => {
    if (!filters.clientId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("client_users")
        .select("user_id, Users!inner(id, name, username, arabic_name, role, team_leader_id)")
        .eq("client_id", filters.clientId)
        .eq("is_active", true);

      const rows = (data ?? []) as unknown as Array<{ user_id: UUID; Users: UserRow }>;
      const list = rows.map((r) => r.Users).filter((u) => isTLRole(u.role) && !isAdminRole(u.role));
      setTls(list);
      setLoading(false);
    })();
  }, [filters.clientId]);

  /* ====== Users (multi-select) ====== */
  useEffect(() => {
    setMarkets([]);
    setSelectedChains([]);
    setSelectedBranches([]);
    setSnapshots([]);
    setSelectedSnapshotIds([]);

    if (!filters.clientId || !filters.teamLeaderId) return;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("client_users")
        .select("user_id, Users!inner(id, name, username, arabic_name, role, team_leader_id)")
        .eq("client_id", filters.clientId)
        .eq("is_active", true);

      const rows = (data ?? []) as unknown as Array<{ user_id: UUID; Users: UserRow }>;
      let list = rows.map((r) => r.Users).filter((u) => !isAdminRole(u.role) && !isTLRole(u.role));

      if (filters.teamLeaderId !== "ALL") {
        list = list.filter((u) => u.team_leader_id === filters.teamLeaderId);
      } else if (tls.length) {
        const byId = new Map<string, UserRow>();
        [...tls, ...list].forEach((u) => byId.set(u.id, u));
        list = Array.from(byId.values());
      }

      list.sort((a, b) => (a.username || "").localeCompare(b.username || "", "ar"));
      setUsers(list);

      setSelectedUsers((prev) => {
        const allowed = new Set(list.map((u) => u.id));
        return prev.filter((id) => allowed.has(id));
      });
      setLoading(false);
    })();
  }, [filters.clientId, filters.teamLeaderId, tls]);

  /* ====== Markets for selectedUsers ====== */
  type MarketsSelect = {
    id: string;
    region: string | null;
    city: string | null;
    store: string | null;
    branch: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };

  useEffect(() => {
    setMarkets([]);
    setSelectedChains([]);
    setSelectedBranches([]);
    setSnapshots([]);
    setSelectedSnapshotIds([]);

    if (selectedUsers.length === 0 || !filters.clientId) return;

    const isUUID = (x: unknown): x is string => typeof x === "string" && x.length > 0;

    (async () => {
      setLoading(true);
      const vmRes = await supabase
        .from("Visits")
        .select("market_id, user_id")
        .eq("client_id", filters.clientId)
        .in("user_id", selectedUsers)
        .not("market_id", "is", null);

      let marketIds = Array.from(new Set((vmRes.data ?? []).map((r) => r.market_id as unknown).filter(isUUID)));

      const snapMarketsRes = await supabase
        .from("DailyVisitSnapshots")
        .select("market_id")
        .eq("client_id", filters.clientId)
        .in("user_id", selectedUsers)
        .not("market_id", "is", null);

      if (!snapMarketsRes.error) {
        const snapIds = (snapMarketsRes.data ?? []).map((r) => r.market_id as unknown).filter(isUUID);
        marketIds = Array.from(new Set([...marketIds, ...snapIds]));
      }

      if (marketIds.length === 0) {
        const cmRes = await supabase.from("client_markets").select("market_id").eq("client_id", filters.clientId);
        marketIds = Array.from(new Set((cmRes.data ?? []).map((r) => r.market_id as unknown).filter(isUUID)));
      }

      if (marketIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("Markets")
        .select("id, region, city, store, branch")
        .in("id", marketIds)
        .throwOnError();

      const rows = (data ?? []) as MarketsSelect[];

      const ms: MarketRow[] = rows.map((r) => ({
        id: String(r.id),
        name: r.branch?.trim() || r.store?.trim() || "—",
        region: r.region,
        city: r.city,
        store: r.store,
        branches: r.branch,
      }));

      setMarkets(ms);

      const regions = Array.from(new Set(ms.map((m) => m.region).filter((x): x is string => !!x))).sort((a, b) =>
        a.localeCompare(b, "ar")
      );
      const cities = Array.from(new Set(ms.map((m) => m.city).filter((x): x is string => !!x))).sort((a, b) =>
        a.localeCompare(b, "ar")
      );
      const stores = Array.from(new Set(ms.map((m) => (m.store || m.name)).filter((x): x is string => !!x))).sort((a, b) =>
        a.localeCompare(b, "ar")
      );

      setRegionsOpts(regions);
      setCitiesOpts(cities);
      setMarketsOpts(stores);
      setLoading(false);
    })();
  }, [selectedUsers, filters.clientId]);

  // فلترة الأسواق
  const filteredMarkets = useMemo(() => {
    return markets.filter((m) => {
      const byRegion = filters.regions.length === 0 || (m.region && filters.regions.includes(m.region));
      const byCity = filters.cities.length === 0 || (m.city && filters.cities.includes(m.city));
      const byMarketName =
        filters.marketsNames.length === 0 ||
        ((m.store && filters.marketsNames.includes(m.store)) || (m.name && filters.marketsNames.includes(m.name)));
      return byRegion && byCity && byMarketName;
    });
  }, [markets, filters.regions, filters.cities, filters.marketsNames]);

  const chains = useMemo(() => {
    const S = new Set<string>();
    filteredMarkets.forEach((m) => {
      const name = (m.store || "").trim();
      if (name) S.add(name);
    });
    return Array.from(S).sort((a, b) => a.localeCompare(b, "ar"));
  }, [filteredMarkets]);

  const branches = useMemo(() => {
    const base = selectedChains.length
      ? filteredMarkets.filter((m) => selectedChains.includes((m.store || "").trim()))
      : filteredMarkets;

    return base
      .map((m) => ({
        id: m.id,
        label:
          (m.branches && m.branches.trim()) ||
          (m.name && m.name.trim()) ||
          (m.store && m.store.trim()) ||
          (m.city && m.city.trim()) ||
          "—",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "ar"));
  }, [filteredMarkets, selectedChains]);

  /* ====== Snapshots via all_visits_combined ====== */
  const [incompleteCount, setIncompleteCount] = useState(0);

  useEffect(() => {
    setSnapshots([]);
    setSelectedSnapshotIds([]);
    setIncompleteCount(0);

    if (!filters.clientId || selectedUsers.length === 0) return;
    if (selectedBranches.length === 0) return;

    (async () => {
      setLoading(true);

      const { data: base } = await supabase
        .from("all_visits_combined")
        .select("visit_id, tl_visit_id")
        .eq("client_id", filters.clientId)
        .in("user_id", selectedUsers)
        .in("market_id", selectedBranches);

      const rows = (base ?? []) as { visit_id: string | null; tl_visit_id: string | null }[];
      const visitIds = Array.from(new Set(rows.map((r) => r.visit_id).filter((x): x is string => !!x)));
      const tlVisitIds = Array.from(new Set(rows.map((r) => r.tl_visit_id).filter((x): x is string => !!x)));

      if (visitIds.length === 0 && tlVisitIds.length === 0) {
        setLoading(false);
        return;
      }

      const collected: SnapshotRow[] = [];

      if (visitIds.length > 0) {
        for (let i = 0; i < visitIds.length; i += 500) {
          const part = visitIds.slice(i, i + 500);
          const { data } = await supabase
            .from("DailyVisitSnapshots")
            .select(
              "id, original_visit_id, tl_visit_id, coordinator_visit_id, user_id, market_id, client_id, snapshot_date, status, started_at, finished_at"
            )
            .in("original_visit_id", part)
            .or("status.eq.finished,started_at.not.is.null")
            .order("started_at", { ascending: false });
          if (data) collected.push(...(data as SnapshotRow[]));
        }
      }

      if (tlVisitIds.length > 0) {
        for (let i = 0; i < tlVisitIds.length; i += 500) {
          const part = tlVisitIds.slice(i, i + 500);
          const { data } = await supabase
            .from("DailyVisitSnapshots")
            .select(
              "id, original_visit_id, tl_visit_id, coordinator_visit_id, user_id, market_id, client_id, snapshot_date, status, started_at, finished_at"
            )
            .in("tl_visit_id", part)
            .or("status.eq.finished,started_at.not.is.null")
            .order("started_at", { ascending: false });
          if (data) collected.push(...(data as SnapshotRow[]));
        }
      }

      let incCount = 0;
      if (visitIds.length > 0) {
        for (let i = 0; i < visitIds.length; i += 500) {
          const part = visitIds.slice(i, i + 500);
          const { count } = await supabase
            .from("DailyVisitSnapshots")
            .select("id", { count: "exact", head: true })
            .in("original_visit_id", part)
            .neq("status", "finished");
          incCount += count ?? 0;
        }
      }
      if (tlVisitIds.length > 0) {
        for (let i = 0; i < tlVisitIds.length; i += 500) {
          const part = tlVisitIds.slice(i, i + 500);
          const { count } = await supabase
            .from("DailyVisitSnapshots")
            .select("id", { count: "exact", head: true })
            .in("tl_visit_id", part)
            .neq("status", "finished");
          incCount += count ?? 0;
        }
      }

      const finishedSorted = collected.sort((a, b) => {
        const at = a.started_at ? +new Date(a.started_at) : 0;
        const bt = b.started_at ? +new Date(b.started_at) : 0;
        return bt - at;
      });
      setSnapshots(finishedSorted);
      setIncompleteCount(incCount);
      setLoading(false);
    })();
  }, [filters.clientId, filters.from, filters.to, selectedUsers, selectedBranches]);

  const statusTotals = useMemo(() => {
    const done = snapshots.length;
    const notDone = incompleteCount;
    return { done, notDone, all: done + notDone };
  }, [snapshots, incompleteCount]);

  const t = useMemo(
    () => ({
      back: ar ? "رجوع" : "Back",
      tls: ar ? "قادة الفريق" : "Team Leaders",
      users: ar ? "المستخدمون" : "Users",
      chains: ar ? "الأسواق" : "Chains",
      branches: ar ? "الفروع" : "Branches",
      dates: ar ? "التواريخ" : "Dates",
      steps: ar ? "خطوات الزيارة" : "Visit Steps",
      pickTL: ar ? "اختر قائد فريق أو كل الفريق أولاً" : "Select a Team Leader or All Team first",
      pickUser: ar ? "اختر مستخدمًا أولاً" : "Pick users first",
      noMarkets: ar ? "لا توجد أسواق" : "No markets",
      pickChain: ar ? "اختر سلسلة" : "Pick a chain",
      pickBranch: ar ? "اختر فرعًا" : "Pick a branch",
      noDates: ar ? "لا توجد تواريخ" : "No dates",
      completed: ar ? "مكتملة" : "Completed",
      incomplete: ar ? "غير كاملة" : "Incomplete",
      promoter: ar ? "تقارير المروج" : "Promoter Reports",
      tlDetails: ar ? "تفاصيل قائد الفريق" : "TL Details",
      pickDate: ar ? "اختر تاريخًا واحدًا" : "Pick a single date",
    }),
    [ar]
  );

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 16, color: "var(--text)" }}>
      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              padding: 18,
              borderRadius: 14,
              border: "1px solid var(--accent)",
              background: "color-mix(in oklab, var(--card) 85%, rgba(0,0,0,.2))",
              boxShadow: "0 8px 30px rgba(0,0,0,.35)",
              color: "#222",
              fontWeight: 800,
            }}
          >
            <div
              className="spin"
              style={{
                width: 36,
                height: 36,
                margin: "0 auto 8px",
                borderRadius: "50%",
                border: "4px solid #d4af37",
                borderTopColor: "transparent",
                animation: "rt 0.9s linear infinite",
              }}
            />
            <div style={{ textAlign: "center", color: "var(--text)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          marginBottom: 16,
          padding: 10,
          borderRadius: 16,
          border: cardBorder,
          background: "color-mix(in oklab, var(--card) 82%, transparent)",
        }}
      >
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          <Capsule label={ar ? "من" : "From"}>
            <DateField label="" value={filters.from} onChange={(v) => setFilters((s) => ({ ...s, from: v }))} locale={ar ? "ar-EG" : "en-GB"} />
          </Capsule>

          <Capsule label={ar ? "إلى" : "To"}>
            <DateField label="" value={filters.to} onChange={(v) => setFilters((s) => ({ ...s, to: v }))} locale={ar ? "ar-EG" : "en-GB"} />
          </Capsule>

          <Capsule label={ar ? "المنطقة" : "Region"} summary={filters.regions.length ? `${filters.regions.length}` : ar ? "الكل" : "All"}>
            <MultiDropdown options={regionsOpts} values={filters.regions} onChange={(v) => setFilters((s) => ({ ...s, regions: v }))} placeholder={ar ? "الكل" : "All"} />
          </Capsule>
          <Capsule label={ar ? "المدينة" : "City"} summary={filters.cities.length ? `${filters.cities.length}` : ar ? "الكل" : "All"}>
            <MultiDropdown options={citiesOpts} values={filters.cities} onChange={(v) => setFilters((s) => ({ ...s, cities: v }))} placeholder={ar ? "الكل" : "All"} />
          </Capsule>
          <Capsule label={ar ? "السوق" : "Market"} summary={filters.marketsNames.length ? `${filters.marketsNames.length}` : ar ? "الكل" : "All"}>
            <MultiDropdown options={marketsOpts} values={filters.marketsNames} onChange={(v) => setFilters((s) => ({ ...s, marketsNames: v }))} placeholder={ar ? "الكل" : "All"} />
          </Capsule>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(260px, 22%) 1fr" }}>
        {/* TL Column */}
        <div style={{ minHeight: 480, borderRadius: 16, border: cardBorder, background: "var(--card)", padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{t.tls}</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button type="button" onClick={() => setFilters((s) => ({ ...s, teamLeaderId: "ALL" }))} style={btn(undefined, filters.teamLeaderId === "ALL")}>
              {ar ? "كل الفريق" : "All Team"}
            </button>
            {tls.map((u) => {
              const sel = filters.teamLeaderId === u.id;
              return (
                <button key={u.id} type="button" onClick={() => setFilters((s) => ({ ...s, teamLeaderId: u.id }))} style={btn(undefined, sel)}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(ar ? u.arabic_name : u.name) || u.username || "—"}
                  </span>
                  <span style={{ opacity: 0.6 }}>▾</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Users */}
          <Panel title={t.users} right={<PillCount n={users.length} />}>
            {users.length === 0 ? (
              <EmptyBox text={t.pickTL} />
            ) : (
              <>
                <div style={{ marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = users.map((u) => u.id);
                      const allSelected = allIds.every((id) => selectedUsers.includes(id));
                      setSelectedUsers(allSelected ? [] : allIds);
                    }}
                    style={btn(undefined, users.length > 0 && users.every((u) => selectedUsers.includes(u.id)))}
                  >
                    {ar ? "تحديد/إلغاء كل الفريق" : "Toggle All Team"}
                  </button>
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                  {users.map((u) => {
                    const sel = selectedUsers.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() =>
                          setSelectedUsers((prev) => (prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]))
                        }
                        style={btn(64, sel)}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: ar ? "right" : "left" }}>
                          <span style={{ fontWeight: 700 }}>{(ar ? u.arabic_name : u.name) || u.username || "—"}</span>
                          <span style={{ opacity: 0.7, fontSize: 12 }}>{roleLabel(u.role, ar)}</span>
                        </div>
                        <span style={{ opacity: 0.6 }}>{sel ? "✓" : "＋"}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Panel>

          {/* Chains */}
          <Panel title={t.chains} right={<PillCount n={chains.length} />}>
            {selectedUsers.length === 0 ? (
              <EmptyBox text={t.pickUser} />
            ) : chains.length === 0 ? (
              <EmptyBox text={t.noMarkets} />
            ) : (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {chains.map((name) => {
                  const sel = selectedChains.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() =>
                        setSelectedChains((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]))
                      }
                      style={btn(48, sel)}
                    >
                      <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</strong>
                      <span style={{ opacity: 0.6 }}>{sel ? "✓" : "＋"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Branches */}
          <Panel title={t.branches} right={<PillCount n={branches.length} />}>
            {selectedUsers.length === 0 ? (
              <EmptyBox text={t.pickUser} />
            ) : branches.length === 0 ? (
              <EmptyBox text={t.pickChain} />
            ) : (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                {branches.map((b) => {
                  const sel = selectedBranches.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        setSelectedBranches((prev) => (prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]))
                      }
                      style={btn(48, sel)}
                    >
                      <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.label}</strong>
                      <span style={{ opacity: 0.6 }}>{sel ? "✓" : "＋"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Dates */}
          <Panel title={`${t.dates} — ${t.completed}: ${statusTotals.done} | ${t.incomplete}: ${statusTotals.notDone}`} right={<PillCount n={statusTotals.all} />}>
            {selectedUsers.length === 0 ? (
              <EmptyBox text={t.pickUser} />
            ) : selectedChains.length === 0 ? (
              <EmptyBox text={ar ? "اختر سلسلة أولًا" : "Pick a store first"} />
            ) : selectedBranches.length === 0 ? (
              <EmptyBox text={t.pickBranch} />
            ) : snapshots.length === 0 ? (
              <EmptyBox text={t.noDates} />
            ) : (
              <>
                <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>{t.pickDate}</div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                  {snapshots.map((s) => {
                    const sel = selectedSnapshotIds.includes(s.id);
                    const started = s.started_at
                      ? new Date(s.started_at).toLocaleString(ar ? "ar-EG" : "en-GB", { timeZone: "Asia/Riyadh" })
                      : "—";
                    const statusNice = (s.status || "").toLowerCase() === "finished" ? (ar ? "مكتملة" : "Finished") : ar ? "غير كاملة" : "Incomplete";
                    return (
                      <button key={s.id} type="button" onClick={() => setSelectedSnapshotIds([s.id])} style={btn(56, sel)}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: ar ? "right" : "left" }}>
                          <strong>{started}</strong>
                          <span style={{ opacity: 0.75, fontSize: 12 }}>{statusNice}</span>
                        </div>
                        <span style={{ opacity: 0.6 }}>{sel ? "✓" : "＋"}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Panel>

          {/* Steps */}
          <Panel title={t.steps}>
            {selectedSnapshotIds.length === 0 ? (
              <div
                style={{
                  border: "1px solid var(--divider)",
                  borderRadius: 12,
                  padding: 16,
                  background: "var(--input-bg)",
                  textAlign: "center",
                }}
              >
                {ar ? "اختر تاريخًا لعرض البيانات" : "Pick a date to view data"}
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <StepsToolbar value={currentStep} onChange={setCurrentStep} onlyKeys={availableSteps} />
                </div>

                <StepDataTable step={currentStep} pageSize={25} visitId={activeVisitId} />
              </>
            )}
          </Panel>

          {/* Back */}
          <div style={{ display: "flex", justifyContent: ar ? "flex-end" : "flex-start" }}>
            <Link
              href="/admin/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 12,
                border: "1px solid var(--accent)",
                background: "var(--accent)",
                color: "#222",
                textDecoration: "none",
                fontWeight: 800,
                direction: ar ? "rtl" : "ltr",
              }}
            >
              {ar ? "→" : "←"} {t.back}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========= styles helpers ========= */
function btn(h?: number, selected = false): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    height: h || 44,
    padding: "10px 12px",
    borderRadius: 12,
    border: selected ? "1px solid var(--accent)" : "1px solid var(--input-border)",
    background: selected ? "color-mix(in oklab, var(--accent) 10%, var(--input-bg))" : "var(--input-bg)",
    color: "var(--text)",
    cursor: "pointer",
    boxShadow: selected ? "0 0 0 2px color-mix(in oklab, var(--accent) 25%, transparent)" : "none",
    fontWeight: 700,
    transition: "all 0.15s ease",
  };
}
function btnSm(selected = false): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: selected ? "1px solid var(--accent)" : "1px solid var(--divider)",
    background: selected ? "color-mix(in oklab, var(--accent) 16%, var(--card))" : "var(--card)",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 800,
    transition: "all 0.15s ease",
  };
}
