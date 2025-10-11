"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useLangTheme } from "@/hooks/useLangTheme";

/* ========= Supabase ========= */
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

  user?: UserLite | null;       // المنسّق
  team_leader?: UserLite | null;
  market?: Market | null;
};

type RawUser = UserLite;
type RawMarket = Market;

/** PostgREST يعيد العلاقات كمصفوفات */
type RawSnapshotRow = {
  id: UUID;
  user_id: UUID;
  market_id: UUID;
  client_id: UUID | null;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
  end_reason: string | null;
  user?: RawUser[] | null;
  market?: RawMarket[] | null;
};

type Stats = {
  total: number;
  finished: number;   // مكتملة (started & finished وبدون end_reason)
  ended: number;      // منتهية (بسبب end_reason)
  pending: number;    // معلّقة (غير ذلك)
  finished_pct: number;
  average_ms_completed: number; // متوسط مدة المكتملة فقط
};

type CountCard = {
  key: string;
  label: string;
  value: number | string;
  pct: number;
  mode: "count";
};
type TextCard = {
  key: string;
  label: string;
  value: string;
  pct: number; // نضعه 100 فقط لرسوم متّسقة
  mode: "text";
};
type Card = CountCard | TextCard;

/* ========= Utils ========= */
function ksaDate(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }); // YYYY-MM-DD
}
function toKSAClock(iso: string | null, isAr: boolean) {
  if (!iso) return "-";
  const dt = new Date(iso);
  return dt.toLocaleTimeString(isAr ? "ar-EG" : "en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Riyadh",
  });
}
function msToClock(ms: number) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function userDisplay(
  u: Pick<UserLite, "username" | "name" | "arabic_name"> | null | undefined,
  isAr = false
) {
  if (!u) return isAr ? "غير معروف" : "Unknown";
  const disp = (isAr ? u.arabic_name : u.name) || u.username;
  return disp || (isAr ? "غير معروف" : "Unknown");
}

/* ========= Page ========= */
export default function YesterdayVisitsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { isArabic: isAr } = useLangTheme();

  const [booting, setBooting] = useState(true);
  const [clientId, setClientId] = useState<UUID | null>(null);

  // أمس بتوقيت الرياض
  const yesterday = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return ksaDate(y);
  }, []);

  // فلاتر
  const [selectedRegion, setSelectedRegion] = useState<string>(params.get("region") || "");
  const [selectedCity, setSelectedCity] = useState<string>(params.get("city") || "");
  const [selectedStore, setSelectedStore] = useState<string>((params.get("market") || "").trim());
  const [selectedTL, setSelectedTL] = useState<string>(params.get("tl") || "");

  // مصادر الفلاتر
  const [regions, setRegions] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<UserLite[]>([]);

  // جدول
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);

  /* ===== boot: session + client ===== */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        router.replace("/login");
        return;
      }

      // client_id المؤكد من client_users (الأدق)
      let cid = localStorage.getItem("client_id");
      if (!cid) {
        const { data: cu, error: cuErr } = await supabase
          .from("client_users")
          .select("client_id")
          .eq("user_id", data.session.user.id)
          .eq("is_active", true)
          .single();

        if (!cuErr && cu?.client_id) {
          cid = String(cu.client_id);
          localStorage.setItem("client_id", cid);
        }
      }

      if (!cid) {
        router.replace("/no-access");
        return;
      }
      setClientId(cid);
      setBooting(false);
    })();
  }, [router]);

  /* ===== fetch snapshots (DailyVisitSnapshots for yesterday) ===== */
  const fetchTable = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const { data: base, error } = await supabase
      .from("DailyVisitSnapshots")
      .select(
        `
          id, user_id, market_id, client_id, status, started_at, finished_at, end_reason, snapshot_date,
          user:Users!dailyvisitsnapshots_user_id_fkey(id, username, name, arabic_name, team_leader_id),
          market:Markets!dailyvisitsnapshots_market_id_fkey(id, region, city, store, branch)
        `
      )
      .eq("client_id", clientId)
      .eq("snapshot_date", yesterday);

    if (error) {
      console.error("[fetchTable] error:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const rawList = (base || []) as (RawSnapshotRow & { snapshot_date: string })[];

    // طبّع العلاقات (أخذ أول عنصر من المصفوفة)
    const list: SnapshotRow[] = rawList.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      market_id: r.market_id,
      client_id: r.client_id,
      status: r.status,
      started_at: r.started_at,
      finished_at: r.finished_at,
      end_reason: r.end_reason,
      user: r.user?.[0] ?? null,
      market: r.market?.[0] ?? null,
    }));

    // اجلب أسماء قادة الفرق (من team_leader_id للمنسّق)
    const tlIds = Array.from(
      new Set(list.map((r) => r.user?.team_leader_id).filter((v): v is UUID => Boolean(v)))
    );
    const tlMap = new Map<UUID, UserLite>();
    if (tlIds.length) {
      const { data: tls } = await supabase
        .from("Users")
        .select("id, username, name, arabic_name, team_leader_id")
        .in("id", tlIds);
      (tls as RawUser[] | null)?.forEach((t) => tlMap.set(t.id, t as UserLite));
    }

    const hydrated: SnapshotRow[] = list.map((r) => ({
      ...r,
      team_leader: r.user?.team_leader_id ? tlMap.get(r.user.team_leader_id) || null : null,
    }));

    setRows(hydrated);
    setLoading(false);
  }, [clientId, yesterday]);

  /* ===== build filters from data (cascading) ===== */
  const hydrateFilters = useCallback(() => {
    const rset = new Set<string>();
    const cset = new Set<string>();
    const sset = new Set<string>();
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

  useEffect(() => {
    if (!clientId) return;
    fetchTable();
  }, [clientId, fetchTable]);

  useEffect(() => {
    hydrateFilters();
  }, [rows, hydrateFilters]);

  /* ===== derived filtered rows for table ===== */
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const okR = selectedRegion ? r.market?.region === selectedRegion : true;
      const okC = selectedCity ? r.market?.city === selectedCity : true;
      const okS = selectedStore ? r.market?.store === selectedStore : true;
      const okTL = selectedTL ? r.user?.team_leader_id === selectedTL : true;
      return okR && okC && okS && okTL;
    });
  }, [rows, selectedRegion, selectedCity, selectedStore, selectedTL]);

  /* ===== status & durations ===== */
  const rowStatus = useCallback(
    (r: SnapshotRow) => {
      // أولوية الحالة حسب طلبك:
      // 1) end_reason موجود => منتهية (Ended)
      // 2) started_at && finished_at => مكتملة (Finished)
      // 3) غير ذلك => معلّقة (Pending / غير مكتملة)
      if (r.end_reason && r.end_reason.trim().length > 0) return isAr ? "منتهية" : "Ended";
      if (r.started_at && r.finished_at) return isAr ? "مكتملة" : "Finished";
      return isAr ? "معلقة" : "Pending";
    },
    [isAr]
  );

  const rowDurationMs = (r: SnapshotRow) => {
    if (!(r.started_at && r.finished_at)) return 0;
    const start = new Date(r.started_at).getTime();
    const end = new Date(r.finished_at).getTime();
    return Math.max(0, end - start);
  };

  const stats: Stats = useMemo(() => {
    const total = filteredRows.length;
    const ended = filteredRows.filter((r) => r.end_reason && r.end_reason.trim().length > 0).length;
    const finishedRows = filteredRows.filter(
      (r) => !r.end_reason && r.started_at && r.finished_at
    );
    const finished = finishedRows.length;
    const pending = total - ended - finished;
    const finished_pct = total ? (finished / total) * 100 : 0;

    const sumMs = finishedRows.reduce((acc, r) => acc + rowDurationMs(r), 0);
    const average_ms_completed = finished ? Math.floor(sumMs / finished) : 0;

    return { total, finished, ended, pending, finished_pct, average_ms_completed };
  }, [filteredRows]);

  const cards: Card[] = useMemo(() => {
    const list: Card[] = [
      {
        key: "total",
        label: isAr ? "إجمالي الزيارات" : "Total Visits",
        value: stats.total,
        pct: 100,
        mode: "count",
      },
      {
        key: "finished",
        label: isAr ? "المكتملة" : "Finished",
        value: stats.finished,
        pct: stats.total ? (stats.finished / stats.total) * 100 : 0,
        mode: "count",
      },
      {
        key: "ended",
        label: isAr ? "المنتهية" : "Ended",
        value: stats.ended,
        pct: stats.total ? (stats.ended / stats.total) * 100 : 0,
        mode: "count",
      },
      {
        key: "pending",
        label: isAr ? "غير المكتملة" : "Pending",
        value: stats.pending,
        pct: stats.total ? (stats.pending / stats.total) * 100 : 0,
        mode: "count",
      },
      {
        key: "avg",
        label: isAr ? "متوسط مدة المكتملة" : "Avg Duration (Finished)",
        value: msToClock(stats.average_ms_completed),
        pct: 100,
        mode: "text",
      },
    ];
    return list;
  }, [stats, isAr]);

  /* ===== styles/helpers ===== */
  const primaryBtnStyle: React.CSSProperties = {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
    padding: "8px 12px",
    border: "none",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
  };

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
  const itemLabel: React.CSSProperties = { fontSize: 12, color: "var(--muted)" };
  const baseField: React.CSSProperties = {
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "var(--input-text)",
    fontSize: 13,
    minWidth: 110,
    appearance: "none",
  };
  const capsuleSelect: React.CSSProperties = { ...baseField, paddingInlineEnd: 14 };

  const thStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "12px 10px",
    fontWeight: 800,
    borderBottom: "1px solid var(--divider)",
  };
  const tdStyle: React.CSSProperties = { textAlign: "center", padding: "12px 10px" };
  const tdCenterMuted: React.CSSProperties = { textAlign: "center", padding: 20, color: "var(--muted)" };

  /* ===== UI ===== */
  if (booting) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--text)" }}>
        {isAr ? "جاري التحقق من الجلسة…" : "Checking session…"}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 16, color: "var(--text)", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <div
          style={{
            width: "min(1100px, 94vw)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
            background: "var(--card)",
            border: "1px solid var(--divider)",
            borderRadius: 12,
            padding: "10px 14px",
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
              {/* Region */}
              <div style={itemShell}>
                <span style={itemLabel}>{isAr ? "المنطقة" : "Region"}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginInlineStart: 2 }}>▾</span>
                <select
                  value={selectedRegion}
                  onChange={(e) => {
                    setSelectedRegion(e.target.value);
                    setSelectedCity("");
                    setSelectedStore("");
                  }}
                  style={capsuleSelect}
                >
                  <option value="">{isAr ? "الكل" : "All"}</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* City */}
              <div style={itemShell}>
                <span style={itemLabel}>{isAr ? "المدينة" : "City"}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginInlineStart: 2 }}>▾</span>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setSelectedStore("");
                  }}
                  style={capsuleSelect}
                >
                  <option value="">{isAr ? "الكل" : "All"}</option>
                  {cities
                    .filter((c) => !selectedRegion || rows.some((r) => r.market?.region === selectedRegion && r.market?.city === c))
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </div>

              {/* Market (store) */}
              <div style={itemShell}>
                <span style={itemLabel}>{isAr ? "السوق" : "Market"}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginInlineStart: 2 }}>▾</span>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  style={capsuleSelect}
                >
                  <option value="">{isAr ? "الكل" : "All"}</option>
                  {stores
                    .filter((s) =>
                      rows.some((r) => {
                        const okR = selectedRegion ? r.market?.region === selectedRegion : true;
                        const okC = selectedCity ? r.market?.city === selectedCity : true;
                        return okR && okC && r.market?.store === s;
                      })
                    )
                    .map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                </select>
              </div>

              {/* Team Leader */}
              <div style={itemShell}>
                <span style={itemLabel}>{isAr ? "قائد الفريق" : "Team Leader"}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginInlineStart: 2 }}>▾</span>
                <select
                  value={selectedTL}
                  onChange={(e) => setSelectedTL(e.target.value)}
                  style={capsuleSelect}
                >
                  <option value="">{isAr ? "الكل" : "All"}</option>
                  {teamLeaders
                    .filter((tl) =>
                      filteredRows.length
                        ? filteredRows.some((r) => r.user?.team_leader_id === tl.id)
                        : rows.some((r) => r.user?.team_leader_id === tl.id)
                    )
                    .map((tl) => (
                      <option key={tl.id} value={tl.id}>
                        {userDisplay(tl, isAr)}
                      </option>
                    ))}
                </select>
              </div>

              <button onClick={fetchTable} style={{ ...primaryBtnStyle, border: "1px solid var(--divider)" }}>
                {isAr ? "تحديث" : "Refresh"}
              </button>

              <button
                onClick={() => {
                  setSelectedRegion("");
                  setSelectedCity("");
                  setSelectedStore("");
                  setSelectedTL("");
                  fetchTable();
                }}
                style={{
                  background: "var(--card)",
                  color: "var(--text)",
                  border: "1px solid var(--divider)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isAr ? "تصفير الفلاتر" : "Clear Filters"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, marginBottom: 18 }}>
        {cards.map((c) => (
          <div
            key={c.key}
            style={{
              width: 200,
              background: "var(--card)",
              border: "1px solid var(--divider)",
              borderRadius: 12,
              padding: 14,
              textAlign: "center",
            }}
          >
            <div style={{ width: 110, height: 110, margin: "0 auto", display: "grid", placeItems: "center" }}>
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
                <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>{c.value}</div>
              )}
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--text)" }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: "min(1100px, 94vw)",
            background: "var(--card)",
            border: "1px solid var(--divider)",
            borderRadius: 12,
            overflowX: "auto",
          }}
          className="no-scrollbar"
        >
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={thStyle}>{isAr ? "المنسّق" : "Coordinator"}</th>
                <th style={thStyle}>{isAr ? "قائد الفريق" : "Team Leader"}</th>
                <th style={thStyle}>{isAr ? "السوق / الفرع" : "Market / Branch"}</th>
                <th style={thStyle}>{isAr ? "وقت البدء" : "Started at"}</th>
                <th style={thStyle}>{isAr ? "وقت الانتهاء" : "Finished at"}</th>
                <th style={thStyle}>{isAr ? "مدة الزيارة" : "Duration"}</th>
                <th style={thStyle}>{isAr ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={tdCenterMuted}>{isAr ? "تحميل…" : "Loading…"}</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={tdCenterMuted}>{isAr ? "لا توجد سجلات" : "No records"}</td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const durMs = rowDurationMs(r);
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        select option { color: #000; background: #fff; }
      `}</style>
    </div>
  );
}
