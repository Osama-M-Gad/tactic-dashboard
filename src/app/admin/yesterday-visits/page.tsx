"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useLangTheme } from "@/hooks/useLangTheme";
import SupaImg from "@/components/SupaImg";


/* ========= Supabase ===== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/* ========= Types ========= */
type UUID = string;
type UserLite = {
  id: UUID;
  username: string | null;
  name: string | null;
  arabic_name: string | null;
  team_leader_id: UUID | null;
};
type Market = {
  id: UUID;
  region: string | null;
  city: string | null;
  store: string | null;
  branch: string | null;
};

type SnapshotRow = {
  id: UUID;
  user_id: UUID;
  market_id: UUID;
  client_id: UUID | null;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
  end_reason: string | null;
  end_reason_ar: string | null;
  end_reason_en: string | null;
  end_visit_photo: string | null;
  jp_state?: "IN JP" | "OUT OF JP" | null;
  user?: UserLite | null;
  team_leader?: UserLite | null;
  market?: Market | null;
};

type VisitDetailsRow = {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  end_reason: string | null;
  end_reason_ar: string | null;
  end_reason_en: string | null;
  end_visit_photo: string | null;
  user_id: string | null;
  user_name: string | null;
  user_arabic_name: string | null;
  user_username: string | null;
  team_leader_id: string | null;
  team_leader_name: string | null;
  team_leader_arabic_name: string | null;
  team_leader_username: string | null;
  market_id: string | null;
  market_store: string | null;
  market_branch: string | null;
  market_city: string | null;
  market_region: string | null;
  jp_state?: "IN JP" | "OUT OF JP" | null;
};

type Stats = {
  total: number;
  finished: number;
  ended: number;
  pending: number;
  finished_pct: number;
  total_visit_ms: number;
  total_transit_ms: number;
};

type CountCard = { key: string; label: string; value: number | string; pct: number; mode: "count" };
type TextCard = { key: string; label: string; value: string; pct: number; mode: "text" };
type Card = CountCard | TextCard;
type JPState = "IN JP" | "OUT OF JP";
type JPStateFilter = "" | JPState;

function isJPStateFilter(v: string): v is JPStateFilter {
  return v === "" || v === "IN JP" || v === "OUT OF JP";
}

function GoldenSpinner({ size = 72, thickness = 6 }: { size?: number; thickness?: number }) {
  const accent = "var(--accent, #F5A623)";
  const bg = "color-mix(in oklab, var(--card) 40%, transparent)";
  return (
    <>
      <div
        role="status"
        aria-label="loading"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `${thickness}px solid ${bg}`,
          borderTopColor: accent,
          animation: "spin 0.9s linear infinite",
          boxShadow: `0 0 0 2px color-mix(in oklab, ${accent} 20%, transparent), inset 0 0 12px color-mix(in oklab, ${accent} 15%, transparent)`,
        }}
      />
      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

/* ========= Utils ========= */
function parseImagePaths(value: unknown): string[] {
  if (!value) return [];
  let data: unknown;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try { data = JSON.parse(trimmed); } catch { return []; }
    } else { return trimmed.split(/[\s,]+/).filter(Boolean); }
  } else { data = value; }
  if (Array.isArray(data)) return data.flat(Infinity).filter((x): x is string => typeof x === "string");
  return [];
}
function ksaDate(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}
function toKSAClock(iso: string | null, isAr: boolean) {
  if (!iso) return "-";
  const dt = new Date(iso);
  return dt.toLocaleTimeString(isAr ? "ar-EG" : "en-US", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Riyadh",
  });
}
function msToClock(ms: number) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function userDisplay(u: Pick<UserLite,"username"|"name"|"arabic_name"> | null | undefined, isAr=false) {
  if (!u) return isAr ? "غير معروف" : "Unknown";
  const disp = (isAr ? u.arabic_name : u.name) || u.username;
  return disp || (isAr ? "غير معروف" : "Unknown");
}
// ✅ مفتاح تجميع للسوق
function marketKey(r: SnapshotRow) {
  const m = r.market;
  if (m?.id) return `id:${m.id}`;
  return `sbcr:${m?.store ?? ""}|${m?.branch ?? ""}|${m?.city ?? ""}|${m?.region ?? ""}`;
}

// ✅ نختار سجل واحد فقط لكل سوق
function pickBest(list: SnapshotRow[], rowStatus: (r: SnapshotRow) => string, isAr: boolean) {
  const S_FIN = isAr ? "مكتملة" : "Finished";
  const S_END = isAr ? "منتهية" : "Ended";
  const S_PEN = isAr ? "معلقة" : "Pending";

  const withStat = list.map(r => ({ r, s: rowStatus(r) }));
  const finished = withStat.filter(x => x.s === S_FIN);
  const ended    = withStat.filter(x => x.s === S_END);
  const pending  = withStat.filter(x => x.s === S_PEN);
  const candidate = finished.length ? finished : (ended.length ? ended : pending);
  if (!candidate.length) return null;

  const best = candidate.reduce((a, b) => {
    const ta = new Date(a.r.finished_at ?? a.r.started_at ?? 0).getTime();
    const tb = new Date(b.r.finished_at ?? b.r.started_at ?? 0).getTime();
    return tb > ta ? b : a;
  });

  return best.r;
}

/* ========= Page ========= */
export default function YesterdayVisitsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { isArabic: isAr } = useLangTheme();

  const [booting, setBooting] = useState(true);
  const [clientId, setClientId] = useState<UUID | null>(null);

  // NEW: أرقام أمس
  const [visitSeconds, setVisitSeconds] = useState<number>(0);
  const [transitSeconds, setTransitSeconds] = useState<number>(0);

  const [viewer, setViewer] = useState<{ open: boolean; imgs: string[]; index: number; title?: string }>({
    open: false, imgs: [], index: 0, title: "",
  });

  const yesterday = useMemo(() => {
    const y = new Date(); y.setDate(y.getDate() - 1); return ksaDate(y);
  }, []);

  const [selectedRegion, setSelectedRegion] = useState<string>(params.get("region") || "");
  const [selectedCity, setSelectedCity] = useState<string>(params.get("city") || "");
  const [selectedStore, setSelectedStore] = useState<string>((params.get("market") || "").trim());
  const [selectedTL, setSelectedTL] = useState<string>(params.get("tl") || "");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedJP, setSelectedJP] = useState<JPStateFilter>("");

  const [regions, setRegions] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<UserLite[]>([]);
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [imgLoading, setImgLoading] = useState(false);

  const openViewer = (imgs: string[], title?: string, index = 0) => {
    setViewer({ open: true, imgs, index, title }); setImgLoading(true);
  };
  const closeViewer = () => setViewer((v) => ({ ...v, open: false }));
  const prevImg = () => { setViewer((v) => ({ ...v, index: (v.index - 1 + v.imgs.length) % v.imgs.length })); setImgLoading(true); };
  const nextImg = () => { setViewer((v) => ({ ...v, index: (v.index + 1) % v.imgs.length })); setImgLoading(true); };

  useEffect(() => {
    if (!viewer.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft") prevImg();
      if (e.key === "ArrowRight") nextImg();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer.open]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) { router.replace("/login"); return; }
      let cid = localStorage.getItem("client_id");
      if (!cid) {
        const { data: cu } = await supabase
          .from("client_users")
          .select("client_id")
          .eq("user_id", data.session.user.id)
          .eq("is_active", true)
          .single();
        if (cu?.client_id) { cid = String(cu.client_id); localStorage.setItem("client_id", cid); }
      }
      if (!cid) { router.replace("/no-access"); return; }
      setClientId(cid);
      setBooting(false);
    })();
  }, [router]);

  const fetchTable = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_yesterday_visits_details", {
      p_client_id: clientId, p_snapshot_date: yesterday,
    });
    if (error) { console.error("[fetchTable RPC] error:", error); setRows([]); setLoading(false); return; }

    const hydrated: SnapshotRow[] = (data || []).map((r: VisitDetailsRow) => ({
      id: r.id,
      status: r.status,
      started_at: r.started_at,
      finished_at: r.finished_at,
      end_reason: r.end_reason,
      end_reason_ar: r.end_reason_ar,
      end_reason_en: r.end_reason_en,
      end_visit_photo: r.end_visit_photo,
      jp_state: r.jp_state ?? null,

      user_id: r.user_id || "",
      market_id: r.market_id || "",
      client_id: clientId,

      user: {
        id: r.user_id || "",
        name: r.user_name,
        arabic_name: r.user_arabic_name,
        username: r.user_username,
        team_leader_id: r.team_leader_id,
      },
      market: r.market_id
        ? { id: r.market_id, store: r.market_store, branch: r.market_branch, city: r.market_city, region: r.market_region }
        : null,
      team_leader: r.team_leader_id
        ? { id: r.team_leader_id, name: r.team_leader_name, arabic_name: r.team_leader_arabic_name, username: r.team_leader_username, team_leader_id: null }
        : null,
    }));

    setRows(hydrated);
    setLoading(false);
  }, [clientId, yesterday]);

  const rowStatus = useCallback((r: SnapshotRow) => {
    const hasEndReason = r.end_reason_ar || r.end_reason_en;
    if (hasEndReason && String(hasEndReason).trim().length > 0) return isAr ? "منتهية" : "Ended";
    if (r.started_at && r.finished_at) return isAr ? "مكتملة" : "Finished";
    return isAr ? "معلقة" : "Pending";
  }, [isAr]);

  const rowJP = useCallback((r: SnapshotRow): "IN JP" | "OUT OF JP" => {
    if (r.jp_state === "IN JP" || r.jp_state === "OUT OF JP") return r.jp_state;
    return "IN JP";
  }, []);

  const hydrateFilters = useCallback(() => {
    const rset = new Set<string>(), cset = new Set<string>(), sset = new Set<string>();
    const tlset = new Map<UUID, UserLite>();
    rows.forEach((r) => {
      if (r.market?.region) rset.add(r.market.region);
      if (r.market?.city) cset.add(r.market.city);
      if (r.market?.store) sset.add(r.market.store);
      if (r.team_leader?.id) tlset.set(r.team_leader.id, r.team_leader);
    });
    const sortAr = (a: string, b: string) => a.localeCompare(b, "ar");
    setRegions(Array.from(rset).sort(sortAr));
    setCities(Array.from(cset).sort(sortAr));
    setStores(Array.from(sset).sort(sortAr));
    setTeamLeaders(Array.from(tlset.values()));
  }, [rows]);

  /* ========= أمس: presence/visit/transit ========= */
  type MarketLite = { id: string; region?: string | null; city?: string | null; store?: string | null };
  type UserTL = { id: string; team_leader_id: string | null };

  const fetchTransitForYesterday = useCallback(async () => {
    if (!clientId) { setVisitSeconds(0); setTransitSeconds(0); return; }
    const day = yesterday; // YYYY-MM-DD Riyadh

    // 1) presence per user (dedup + clamp)
    let pres = 0;
    {
      let q = supabase
        .from("v_presence_visit_unified")
        .select("user_id, presence_for_sum, region, city, store, team_leader_id")
        .eq("client_id", clientId)
        .eq("snapshot_date", day);

      if (selectedRegion) q = q.eq("region", selectedRegion);
      if (selectedCity)   q = q.eq("city", selectedCity);
      if (selectedStore)  q = q.eq("store", selectedStore);
      if (selectedTL)     q = q.eq("team_leader_id", selectedTL);

      const byUser = new Map<string, number>();
      const pageSize = 1000; let from = 0, to = pageSize - 1;
      while (true) {
        const { data, error } = await q.range(from, to);
        if (error) { console.error("[presence yesterday] error:", error); break; }
        const rows = (data ?? []) as Array<{ user_id: string | null; presence_for_sum: number | null }>;
        for (const r of rows) {
          const uid = r.user_id ? String(r.user_id) : "";
          if (!uid) continue;
          const secs = Math.max(0, Math.min(86400, Number(r.presence_for_sum || 0)));
          const prev = byUser.get(uid) ?? 0;
          if (secs > prev) byUser.set(uid, secs);
        }
        if (!rows.length || rows.length < pageSize) break;
        from += pageSize; to += pageSize;
      }
      pres = Array.from(byUser.values()).reduce((a, b) => a + b, 0);
    }

    // 2) visit seconds (complete visits yesterday)
    let visit = 0;
    {
      const q = supabase
        .from("DailyVisitSnapshots")
        .select("user_id, market_id, started_at, finished_at")
        .eq("client_id", clientId)
        .eq("snapshot_date", day)
        .not("started_at", "is", null)
        .not("finished_at", "is", null);

      const needMarketFilter = !!(selectedRegion || selectedCity || selectedStore);
      const marketsById: Record<string, MarketLite> = {};
      if (needMarketFilter) {
        const { data: mData } = await supabase
          .from("Markets")
          .select("id, region, city, store");
        for (const m of (mData ?? []) as MarketLite[]) {
          marketsById[String(m.id)] = m;
        }
      }

      const userTL: Record<string, string | null> = {};
      if (selectedTL) {
        const { data: uData } = await supabase.from("Users").select("id, team_leader_id");
        for (const u of (uData ?? []) as UserTL[]) {
          userTL[String(u.id)] = u.team_leader_id ? String(u.team_leader_id) : null;
        }
      }

      const pageSize = 1000; let from = 0, to = pageSize - 1;
      while (true) {
        const { data, error } = await q.range(from, to);
        if (error) { console.error("[visits yesterday] error:", error); break; }
        const rows = (data ?? []) as Array<{ user_id: string | null; market_id: string | null; started_at: string; finished_at: string }>;
        for (const r of rows) {
          if (selectedTL) {
            const tl = userTL[String(r.user_id)] || null;
            if (tl !== selectedTL) continue;
          }
          if (needMarketFilter) {
            const m = r.market_id ? marketsById[String(r.market_id)] : undefined;
            if (!m) continue;
            if (selectedRegion && m.region !== selectedRegion) continue;
            if (selectedCity   && m.city   !== selectedCity)   continue;
            if (selectedStore  && m.store  !== selectedStore)  continue;
          }
          const start = new Date(r.started_at).getTime();
          const end   = new Date(r.finished_at).getTime();
          visit += Math.max(0, Math.floor((end - start) / 1000));
        }
        if (!rows.length || rows.length < pageSize) break;
        from += pageSize; to += pageSize;
      }
    }

    // 3) transit
    const transit = Math.max(0, pres - visit);
    setVisitSeconds(visit);
    setTransitSeconds(transit);
  }, [clientId, yesterday, selectedRegion, selectedCity, selectedStore, selectedTL]);

  useEffect(() => { if (!clientId) return; fetchTable(); }, [clientId, fetchTable]);

  // أمس presence/visit/transit
  useEffect(() => {
    if (!clientId) return;
    void fetchTransitForYesterday();
  }, [clientId, yesterday, selectedRegion, selectedCity, selectedStore, selectedTL, fetchTransitForYesterday]);

  useEffect(() => { hydrateFilters(); }, [rows, hydrateFilters]);

  // ✅ نجمع الصفوف على مستوى السوق ونختار واحد فقط لكل سوق حسب القاعدة
  const collapsedRows = useMemo(() => {
    const groups = new Map<string, SnapshotRow[]>();
    for (const r of rows) {
      const k = marketKey(r);
      if (!k) continue;
      const arr = groups.get(k) ?? [];
      arr.push(r);
      groups.set(k, arr);
    }
    const out: SnapshotRow[] = [];
    for (const [, list] of groups) {
      const best = pickBest(list, rowStatus, isAr);
      if (best) out.push(best);
    }
    return out;
  }, [rows, rowStatus, isAr]);

  const filteredRows = useMemo(() => {
    return collapsedRows.filter((r) => {
      const okR  = selectedRegion ? r.market?.region === selectedRegion : true;
      const okC  = selectedCity ? r.market?.city === selectedCity : true;
      const okS  = selectedStore ? r.market?.store === selectedStore : true;
      const okTL = selectedTL ? r.user?.team_leader_id === selectedTL : true;
      const okSt = selectedStatus ? rowStatus(r) === selectedStatus : true;
      const jp   = rowJP(r);
      const okJP = selectedJP ? jp === selectedJP : true;
      return okR && okC && okS && okTL && okSt && okJP;
    });
  }, [collapsedRows, selectedRegion, selectedCity, selectedStore, selectedTL, selectedStatus, selectedJP, rowStatus, rowJP]);

  const rowDurationMs = (r: SnapshotRow) => {
    if (!(r.started_at && r.finished_at)) return 0;
    const start = new Date(r.started_at).getTime();
    const end = new Date(r.finished_at).getTime();
    return Math.max(0, end - start);
  };

  const matchAllFilters = useCallback((r: SnapshotRow) => {
    const okR  = selectedRegion ? r.market?.region === selectedRegion : true;
    const okC  = selectedCity ? r.market?.city === selectedCity : true;
    const okS  = selectedStore ? r.market?.store === selectedStore : true;
    const okTL = selectedTL ? r.user?.team_leader_id === selectedTL : true;
    const okSt = selectedStatus ? rowStatus(r) === selectedStatus : true;
    const jp   = rowJP(r);
    const okJP = selectedJP ? jp === selectedJP : true;
    return okR && okC && okS && okTL && okSt && okJP;
  }, [selectedRegion, selectedCity, selectedStore, selectedTL, selectedStatus, selectedJP, rowStatus, rowJP]);

  const stats: Stats = useMemo(() => {
    const rowsFilteredAll = rows.filter(matchAllFilters);

    const total = rowsFilteredAll.length;
    const ended = rowsFilteredAll.filter((r) =>
      (r.end_reason_ar || r.end_reason_en)?.toString().trim().length).length;

    const finishedRows = rowsFilteredAll.filter(
      (r) => !(r.end_reason_ar || r.end_reason_en) && r.started_at && r.finished_at
    );

    const finished = finishedRows.length;
    const pending  = total - ended - finished;

    // نستخدم visit/transit (seconds) المحسوبين لأمس
    const total_visit_ms   = visitSeconds  * 1000;
    const total_transit_ms = transitSeconds * 1000;

    return {
      total,
      finished,
      ended,
      pending,
      finished_pct: total ? (finished / total) * 100 : 0,
      total_visit_ms,
      total_transit_ms,
    };
  }, [rows, matchAllFilters, visitSeconds, transitSeconds]);

  const cards: Card[] = useMemo(() => [
    { key: "total",    label: isAr ? "إجمالي الزيارات" : "Total Visits",
      value: stats.total,    pct: 100, mode: "count" },
    { key: "finished", label: isAr ? "المكتملة" : "Finished",
      value: stats.finished, pct: stats.total ? (stats.finished / stats.total) * 100 : 0, mode: "count" },
    { key: "ended",    label: isAr ? "المنتهية" : "Ended",
      value: stats.ended,    pct: stats.total ? (stats.ended / stats.total) * 100 : 0, mode: "count" },
    { key: "pending",  label: isAr ? "غير المكتملة" : "Pending",
      value: stats.pending,  pct: stats.total ? (stats.pending / stats.total) * 100 : 0, mode: "count" },

    { key: "visit_sum", label: isAr ? "إجمالي وقت الزيارة" : "Total Visit Time",
      value: msToClock(stats.total_visit_ms), pct: 100, mode: "text" },

    { key: "transit_sum", label: isAr ? "إجمالي وقت التنقل" : "Total Travel Time",
      value: msToClock(stats.total_transit_ms), pct: 100, mode: "text" },
  ], [stats, isAr]);

  const primaryBtnStyle: React.CSSProperties = {
    backgroundColor: "var(--accent)", color: "var(--accent-foreground)", padding: "8px 12px",
    border: "none", borderRadius: 10, fontWeight: 800, cursor: "pointer",
  };
  const capsuleStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8, background: "var(--card)",
    border: "1px solid var(--divider)", borderRadius: 9999, padding: 6, whiteSpace: "nowrap",
  };
  const itemShell: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    borderRadius: 9999,
    padding: "4px 8px",
    whiteSpace: "nowrap",
  };

  const itemLabel: React.CSSProperties = { fontSize: 12, color: "var(--muted)" };
  const baseField: React.CSSProperties = {
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "var(--input-text)",
    fontSize: 12,
    minWidth: 80,
    appearance: "none",
  };

  const capsuleSelect: React.CSSProperties = {
    ...baseField,
    paddingInlineEnd: 10,
    paddingInlineStart: 2,
    maxWidth: 90,
  };

  const thStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "10px 10px",
    fontWeight: 800,
    borderBottom: "1px solid var(--divider)",
  };
  const tdStyle: React.CSSProperties = { textAlign: "center", padding: "10px 10px" };

  const tdCenterMuted: React.CSSProperties = { textAlign: "center", padding: 20, color: "var(--muted)" };
  const modalOverlayStyle: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.75)", display: "flex", justifyContent: "center", alignItems: "center",
    zIndex: 1000, cursor: "zoom-out"
  };
  const modalContentStyle: React.CSSProperties = {
    position: "relative", maxWidth: "96vw", width: "auto", maxHeight: "90vh",
    backgroundColor: "var(--card)", borderRadius: 16, padding: 12, border: "1px solid var(--divider)", cursor: "default"
  };
  const modalCloseButtonStyle: React.CSSProperties = {
    position: "absolute", top: "10px", background: "transparent", border: "none",
    color: "var(--text)", fontSize: "28px", cursor: "pointer", lineHeight: 1, zIndex: 10,
    ...(isAr ? { left: "15px" } : { right: "15px" }),
  };

  if (booting) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--text)" }}>
        {isAr ? "جاري التحقق من الجلسة…" : "Checking session…"}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 16, color: "var(--text)", background: "var(--bg)" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <div
          style={{
            width: "min(1100px, 94vw)", display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between",
            background: "var(--card)", border: "1px solid var(--divider)", borderRadius: 12, padding: "10px 14px",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {isAr ? "زيارات أمس" : "Yesterday’s Visits"} — {yesterday}
          </div>
          <button onClick={() => router.push("/admin/dashboard")} style={primaryBtnStyle}>
            {isAr ? "رجوع" : "Back"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <div style={{ width: "min(1100px, 94vw)" }}>
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
            <div style={capsuleStyle}>
              <div style={itemShell}>
                <span style={itemLabel}>{isAr ? "الحالة" : "Status"}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginInlineStart: 2 }}>▾</span>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={capsuleSelect}>
                  <option value="">{isAr ? "الكل" : "All"}</option>
                  <option value={isAr ? "مكتملة" : "Finished"}>{isAr ? "مكتملة" : "Finished"}</option>
                  <option value={isAr ? "منتهية" : "Ended"}>{isAr ? "منتهية" : "Ended"}</option>
                  <option value={isAr ? "معلقة" : "Pending"}>{isAr ? "معلقة" : "Pending"}</option>
                </select>
              </div>

              {/* JP */}
              <div style={itemShell}>
                <span style={itemLabel}>{isAr ? "رحلة العمل" : "JP State"}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginInlineStart: 2 }}>▾</span>
                <select
                  value={selectedJP}
                  onChange={(e) => { const v = e.target.value; if (isJPStateFilter(v)) setSelectedJP(v); }}
                  style={capsuleSelect}
                >
                  <option value="">{isAr ? "الكل" : "All"}</option>
                  <option value="IN JP">IN JP</option>
                  <option value="OUT OF JP">OUT OF JP</option>
                </select>
              </div>

              <div style={itemShell}>
                <span style={itemLabel}>{isAr ? "المنطقة" : "Region"}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginInlineStart: 2 }}>▾</span>
                <select
                  value={selectedRegion}
                  onChange={(e) => { setSelectedRegion(e.target.value); setSelectedCity(""); setSelectedStore(""); }}
                  style={capsuleSelect}
                >
                  <option value="">{isAr ? "الكل" : "All"}</option>
                  {regions.map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>

              <div style={itemShell}>
                <span style={itemLabel}>{isAr ? "المدينة" : "City"}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginInlineStart: 2 }}>▾</span>
                <select
                  value={selectedCity}
                  onChange={(e) => { setSelectedCity(e.target.value); setSelectedStore(""); }}
                  style={capsuleSelect}
                >
                  <option value="">{isAr ? "الكل" : "All"}</option>
                  {cities
                    .filter((c) => !selectedRegion || rows.some((r) => r.market?.region === selectedRegion && r.market?.city === c))
                    .map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>

              <div style={itemShell}>
                <span style={itemLabel}>{isAr ? "السوق" : "Market"}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginInlineStart: 2 }}>▾</span>
                <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} style={capsuleSelect}>
                  <option value="">{isAr ? "الكل" : "All"}</option>
                  {stores
                    .filter((s) =>
                      rows.some(
                        (r) =>
                          (!selectedRegion || r.market?.region === selectedRegion) &&
                          (!selectedCity || r.market?.city === selectedCity) &&
                          r.market?.store === s
                      )
                    )
                    .map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>

              <div style={itemShell}>
                <span style={itemLabel}>{isAr ? "قائد الفريق" : "Team Leader"}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginInlineStart: 2 }}>▾</span>
                <select value={selectedTL} onChange={(e) => setSelectedTL(e.target.value)} style={capsuleSelect}>
                  <option value="">{isAr ? "الكل" : "All"}</option>
                  {teamLeaders.map((tl) => (<option key={tl.id} value={tl.id}>{userDisplay(tl, isAr)}</option>))}
                </select>
              </div>

              <button onClick={fetchTable} style={{ ...primaryBtnStyle, border: "1px solid var(--divider)" }}>
                {isAr ? "تحديث" : "Refresh"}
              </button>
              <button
                onClick={() => {
                  setSelectedRegion(""); setSelectedCity(""); setSelectedStore("");
                  setSelectedTL(""); setSelectedStatus(""); setSelectedJP("");
                  fetchTable();
                }}
                style={{
                  background: "var(--card)", color: "var(--text)", border: "1px solid var(--divider)",
                  borderRadius: 10, padding: "8px 12px", fontWeight: 800, cursor: "pointer",
                }}
              >
                {isAr ? "تصفير الفلاتر" : "Clear Filters"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        {(() => {
          const count = cards.length;
          const gap = 12;
          const basis = `calc((100% - ${gap * (count - 1)}px) / ${count})`;
          return (
            <div style={{ width: "min(1100px, 94vw)", display: "flex", gap, flexWrap: "nowrap" }}>
              {cards.map((c) => (
                <div
                  key={c.key}
                  style={{
                    flex: `0 0 ${basis}`,
                    maxWidth: 180,
                    minWidth: 120,
                    background: "var(--card)",
                    border: "1px solid var(--divider)",
                    borderRadius: 10,
                    padding: 10,
                    textAlign: "center",
                  }}
                >
                  <div style={{ width: 90, height: 90, margin: "0 auto", display: "grid", placeItems: "center" }}>
                    {c.mode === "count" ? (
                      <CircularProgressbar
                        value={c.pct}
                        text={`${c.value}`}
                        styles={buildStyles({
                          textColor: "var(--text)",
                          pathColor: "var(--accent)",
                          trailColor: "var(--chip-bg)",
                        })}
                      />
                    ) : (
                      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
                        {c.value}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--text)" }}>{c.label}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Table */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: "min(1100px, 94vw)",
            background: "var(--card)",
            border: "1px solid var(--divider)",
            borderRadius: 16,
            overflow: "hidden"
          }}
          className="no-scrollbar"
        >
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={thStyle}>{isAr ? "المستخدم" : "User"}</th>
                <th style={thStyle}>{isAr ? "قائد الفريق" : "Team Leader"}</th>
                <th style={thStyle}>{isAr ? "السوق / الفرع" : "Market / Branch"}</th>
                <th style={thStyle}>{isAr ? "وقت البدء" : "Started at"}</th>
                <th style={thStyle}>{isAr ? "وقت الانتهاء" : "Finished at"}</th>
                <th style={thStyle}>{isAr ? "مدة الزيارة" : "Duration"}</th>
                <th style={thStyle}>{isAr ? "الحالة" : "Status"}</th>
                <th style={thStyle}>{isAr ? "حالة JP" : "JP State"}</th>
                <th style={thStyle}>{isAr ? "سبب الإنهاء" : "End Reason"}</th>
                <th style={thStyle}>{isAr ? "الصورة" : "Photo"}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={tdCenterMuted}>{isAr ? "تحميل…" : "Loading…"}</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={10} style={tdCenterMuted}>{isAr ? "لا توجد سجلات" : "No records"}</td></tr>
              ) : (
                filteredRows.map((r) => {
                  const durMs = rowDurationMs(r);
                  const images = parseImagePaths(r.end_visit_photo);
                  const jp = rowJP(r);
                  const jpStyle: React.CSSProperties = {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 0.2,
                    background: jp === "IN JP" ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
                    border: `1px solid ${jp === "IN JP" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
                    color: jp === "IN JP" ? "#16a34a" : "#ef4444",
                    minWidth: 64,
                    justifyContent: "center",
                    textTransform: "uppercase",
                  };

                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--divider)" }}>
                      <td style={tdStyle}>{userDisplay(r.user, isAr)}</td>
                      <td style={tdStyle}>{r.team_leader ? userDisplay(r.team_leader, isAr) : "-"}</td>
                      <td style={tdStyle}>
                        <div style={{ lineHeight: 1.2 }}>
                          <div style={{ fontWeight: 700 }}>{r.market?.store || "-"}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {(isAr ? "الفرع" : "Branch")}: {r.market?.branch || "-"}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>{toKSAClock(r.started_at, isAr)}</td>
                      <td style={tdStyle}>{toKSAClock(r.finished_at, isAr)}</td>
                      <td style={tdStyle}>{durMs ? msToClock(durMs) : "-"}</td>
                      <td style={tdStyle}>{rowStatus(r)}</td>
                      <td style={tdStyle}><span style={jpStyle}>{rowJP(r)}</span></td>
                      <td style={tdStyle}>{(isAr ? r.end_reason_ar : r.end_reason_en) || r.end_reason || "-"}</td>
                      <td style={tdStyle}>
                        {images.length > 0 ? (
                          <button
                            onClick={() => openViewer(images, isAr ? "صورة نهاية الزيارة" : "End of Visit Photo")}
                            style={{ ...primaryBtnStyle, padding: "6px 10px", fontSize: 12 }}
                          >
                            {isAr ? `فتح (${images.length})` : `Open (${images.length})`}
                          </button>
                        ) : ("-")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox */}
      {viewer.open && (
        <div onClick={closeViewer} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalContentStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>{viewer.title || ""}</strong>
              <button onClick={closeViewer} style={modalCloseButtonStyle}>&times;</button>
            </div>

            <div style={{ position: "relative", width: "100%", minWidth: "min(500px, 80vw)", height: "70vh", backgroundColor: "var(--input-bg)", borderRadius: 12, overflow: "hidden" }}>
              <img
                key={viewer.imgs[viewer.index] + "-preloader"}
                src={viewer.imgs[viewer.index]}
                onLoad={() => setImgLoading(false)}
                onError={() => setImgLoading(false)}
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                alt=""
              />
              {imgLoading && (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 1, background: "var(--input-bg)" }}>
                  <GoldenSpinner />
                </div>
              )}
              {viewer.imgs.length > 1 && (
                <button
                  onClick={prevImg}
                  style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", padding: "8px 12px", borderRadius: 99, border: "1px solid var(--divider)", backgroundColor: "rgba(0,0,0,0.4)", color: "white", zIndex: 2 }}
                  title={isAr ? "السابق" : "Prev"}
                >‹</button>
              )}
              <SupaImg
                key={viewer.imgs[viewer.index]}
                src={viewer.imgs[viewer.index]}
                alt="preview"
                style={{ width: "100%", height: "100%", objectFit: "contain", opacity: imgLoading ? 0 : 1, transition: "opacity 0.2s" }}
              />
              {viewer.imgs.length > 1 && (
                <button
                  onClick={nextImg}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", padding: "8px 12px", borderRadius: 99, border: "1px solid var(--divider)", backgroundColor: "rgba(0,0,0,0.4)", color: "white", zIndex: 2 }}
                  title={isAr ? "التالي" : "Next"}
                >›</button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <div style={{ opacity: 0.8, fontSize: 12 }}>{viewer.index + 1} / {viewer.imgs.length}</div>
              {viewer.imgs.length > 1 && (
                <div style={{ display: "flex", gap: 8, overflow: "auto", maxWidth: "calc(100% - 50px)" }}>
                  {viewer.imgs.map((u, i) => (
                    <button
                      key={u + i}
                      style={{ flexShrink: 0, position: "relative", width: 48, height: 48, borderRadius: 6, border: `2px solid ${i === viewer.index ? "var(--accent)" : "var(--divider)"}` }}
                      onClick={() => { setViewer((v) => ({ ...v, index: i })); setImgLoading(true); }}
                      title={`${i + 1}`}
                    >
                      <SupaImg src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        table tbody tr + tr td { border-top: 1px solid var(--divider); }
        thead th { background: var(--header-bg); position: sticky; top: 0; z-index: 1; }
        td { vertical-align: middle; }
        select option { color: #000; background: #fff; }
      `}</style>
    </div>
  );
}
