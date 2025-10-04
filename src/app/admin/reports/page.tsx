"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";

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

type ClientUsersJoin = { user_id: UUID; Users: UserRow };

type MarketRow = { id: UUID; name: string; city_id?: UUID | null; region_id?: UUID | null };

type VisitRow = {
  id: UUID;
  user_id: UUID | null;
  client_id: UUID | null;
  market_id: UUID | null;
  started_at: string | null;
  finished_at: string | null;
  status: string | null;
};

type SnapshotRow = {
  id: UUID;
  original_visit_id: UUID | null;
  user_id: UUID;
  market_id: UUID;
  snapshot_date: string; // date
  status: string;
  started_at: string | null;
  finished_at: string | null;
};

/* ========= Lang (بدون هوك خارجي) ========= */
function getIsArabicFromHtml(): boolean {
  if (typeof document === "undefined") return false;
  const dir = document.documentElement.getAttribute("dir");
  return (dir || "").toLowerCase() === "rtl";
}

/* ========= LS helpers ========= */
const LS_KEYS = { clientId: "client_id" } as const;

function getStoredClientId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem(LS_KEYS.clientId) ||
      sessionStorage.getItem(LS_KEYS.clientId)
    );
  } catch {
    return null;
  }
}

/* ========= Small UI helpers ========= */
const capsuleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 12,
  padding: "10px 12px",
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--text)",
};

const dateInputStyle: React.CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--text)",
  fontSize: 13,
  width: "100%",
};

const pillBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  borderRadius: 12,
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--text)",
  padding: "10px 12px",
  fontSize: 13,
  cursor: "pointer",
};

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
        border: "1px solid var(--divider)",
        background: "var(--card)",
        color: "var(--muted, #aaa)",
        fontSize: 12,
      }}
    >
      {n}
    </span>
  );
}

function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--divider)",
        background: "var(--card)",
        borderRadius: 16,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text)",
            opacity: 0.9,
          }}
        >
          {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ========= Filters Bar ========= */
function FiltersBar({
  isArabic,
  filters,
  onChange,
}: {
  isArabic: boolean;
  filters: {
    clientId: string;
    regionId: string | null;
    cityId: string | null;
    marketId: string | null;
    teamLeaderId: string | "ALL" | null;
    from: string;
    to: string;
  };
  onChange: (p: Partial<typeof filters>) => void;
}) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        marginBottom: 16,
        padding: 10,
        borderRadius: 16,
        border: "1px solid var(--divider)",
        background: "color-mix(in oklab, var(--card) 82%, transparent)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
        }}
      >
        {/* Date From */}
        <div style={capsuleStyle}>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
            style={dateInputStyle}
          />
        </div>

        {/* Date To */}
        <div style={capsuleStyle}>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
            style={dateInputStyle}
          />
        </div>

        {/* Region */}
        <button type="button" style={pillBtnStyle}>
          {isArabic ? "المنطقة" : "Region"} <span style={{ opacity: 0.6 }}>▾</span>
        </button>

        {/* City */}
        <button type="button" style={pillBtnStyle}>
          {isArabic ? "المدينة" : "City"} <span style={{ opacity: 0.6 }}>▾</span>
        </button>

        {/* Market */}
        <button type="button" style={pillBtnStyle}>
          {isArabic ? "السوق" : "Market"} <span style={{ opacity: 0.6 }}>▾</span>
        </button>

        {/* Team Leader */}
        <button type="button" style={pillBtnStyle}>
          {isArabic ? "قائد الفريق" : "Team Leader"}{" "}
          <span style={{ opacity: 0.6 }}>▾</span>
        </button>
      </div>

      {/* إخفاء أيقونة التاريخ */}
      <style jsx>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0;
          display: none;
          -webkit-appearance: none;
        }
        input[type="date"] {
          appearance: none;
          -webkit-appearance: none;
          text-align: ${isArabic ? "right" : "left"};
        }
      `}</style>
    </div>
  );
}

/* ========= Main ========= */
export default function Page() {
  const isArabic = getIsArabicFromHtml();
  const search = useSearchParams();

  // فلاتر
  const [filters, setFilters] = useState({
    clientId: "",
    regionId: null as UUID | null,
    cityId: null as UUID | null,
    marketId: null as UUID | null,
    teamLeaderId: null as UUID | "ALL" | null,
    from: new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  // بيانات العرض
  const [tls, setTls] = useState<UserRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [visits, setVisits] = useState<(VisitRow & { snapshot?: SnapshotRow | null })[]>([]);

  // اختيارات
  const [selectedUser, setSelectedUser] = useState<UUID | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<UUID | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<UUID | null>(null);

  /* ====== init: clientId + query params ====== */
 useEffect(() => {
  const cid = getStoredClientId();
  if (cid) {
    setFilters((s) => ({ ...s, clientId: cid }));
  }
  if (!search) return;
  const from = search.get("from");
  const to = search.get("to");
  const tl = search.get("tl") as UUID | "ALL" | null;
  setFilters((s) => ({
    ...s,
    from: from || s.from,
    to: to || s.to,
    teamLeaderId: tl ?? s.teamLeaderId,
  }));
}, [search]);

  /* ====== fetch TLs ====== */
  useEffect(() => {
    if (!filters.clientId) return;
    (async () => {
      const { data } = await supabase
        .from("client_users")
        .select("user_id, Users!inner(id, name, username, arabic_name, role, team_leader_id)")
        .eq("client_id", filters.clientId)
        .eq("is_active", true);

      const rows = (data ?? []) as unknown as ClientUsersJoin[];
      const list = rows
        .map((r) => r.Users)
        .filter((u) => (u.role || "").toLowerCase().includes("team leader"));
      setTls(list);
    })();
  }, [filters.clientId]);

  /* ====== fetch users when TL or ALL set ====== */
  useEffect(() => {
    if (!filters.clientId || !filters.teamLeaderId) {
      setUsers([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("client_users")
        .select("user_id, Users!inner(id, name, username, arabic_name, role, team_leader_id)")
        .eq("client_id", filters.clientId)
        .eq("is_active", true);

      const rows = (data ?? []) as unknown as ClientUsersJoin[];
      let list: UserRow[] = rows.map((r) => r.Users);

      if (filters.teamLeaderId !== "ALL") {
        list = list.filter((u) => u.team_leader_id === filters.teamLeaderId);
      }
      // exclude TLs
      list = list.filter((u) => !(u.role || "").toLowerCase().includes("team leader"));
      setUsers(list);
    })();
  }, [filters.clientId, filters.teamLeaderId]);

  /* ====== markets for selected user ====== */
  useEffect(() => {
    setSelectedMarket(null);
    setSelectedVisit(null);
    setMarkets([]);
    setVisits([]);

    if (!selectedUser || !filters.clientId) return;
    (async () => {
      const { data: visitMarkets } = await supabase
        .from("Visits")
        .select("market_id")
        .eq("client_id", filters.clientId)
        .eq("user_id", selectedUser)
        .not("market_id", "is", null);

     type VisitMarketOnly = { market_id: UUID | null };
const marketIds = Array.from(
  new Set(
    ((visitMarkets || []) as VisitMarketOnly[])
      .map((v) => v.market_id)
      .filter((id): id is UUID => !!id)
  )
);
      if (!marketIds.length) return;

      const { data: marketsRows } = await supabase
        .from("Markets")
        .select("id, name, city_id, region_id")
        .in("id", marketIds);

      setMarkets((marketsRows || []) as MarketRow[]);
    })();
  }, [selectedUser, filters.clientId]);

  /* ====== visits for selected market + range ====== */
  useEffect(() => {
    setSelectedVisit(null);
    setVisits([]);

    if (!selectedMarket || !filters.clientId) return;
    (async () => {
      const fromISO = new Date(filters.from + "T00:00:00.000Z").toISOString();
      const toISO = new Date(filters.to + "T23:59:59.999Z").toISOString();

      const { data: visitRows } = await supabase
        .from("Visits")
        .select("id, user_id, client_id, market_id, started_at, finished_at, status")
        .eq("client_id", filters.clientId)
        .eq("market_id", selectedMarket)
        .gte("started_at", fromISO)
        .lte("started_at", toISO)
        .order("started_at", { ascending: false });

      const ids = (visitRows || []).map((v) => v.id);
      const snapshots = new Map<UUID, SnapshotRow>();
      if (ids.length) {
        const { data: snapRows } = await supabase
          .from("DailyVisitSnapshots")
          .select("id, original_visit_id, user_id, market_id, snapshot_date, status, started_at, finished_at")
          .in("original_visit_id", ids);
        for (const s of (snapRows || []) as SnapshotRow[]) {
          if (s.original_visit_id) snapshots.set(s.original_visit_id, s);
        }
      }

      const merged = (visitRows || []).map((v) => ({ ...v, snapshot: snapshots.get(v.id) || null }));
      setVisits(merged);
    })();
  }, [selectedMarket, filters.clientId, filters.from, filters.to]);

  /* ====== strings ====== */
  const t = useMemo(
    () => ({
      back: isArabic ? "رجوع" : "Back",
      tls: isArabic ? "قادة الفريق" : "Team Leaders",
      users: isArabic ? "المستخدمون" : "Users",
      markets: isArabic ? "الأسواق" : "Markets",
      visits: isArabic ? "الزيارات" : "Visits",
      steps: isArabic ? "خطوات الزيارة" : "Visit Steps",
      pickTL: isArabic ? "اختر قائد فريق أو كل الفريق أولاً" : "Select a Team Leader or All Team first",
      pickUser: isArabic ? "اختر مستخدمًا أولاً" : "Pick a user first",
      noMarkets: isArabic ? "لا توجد أسواق لهذا المستخدم" : "No markets for this user",
      pickMarket: isArabic ? "اختر سوقًا أولاً" : "Pick a market first",
      noVisits: isArabic ? "لا توجد زيارات في المدى الزمني" : "No visits in the selected range",
      pickVisit: isArabic ? "اختر زيارة لعرض الخطوات" : "Pick a visit to view steps",
      details: isArabic ? "التفاصيل" : "Details",
    }),
    [isArabic]
  );

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 16, color: "var(--text)" }}>
      <FiltersBar
        isArabic={isArabic}
        filters={filters}
        onChange={(p) => setFilters((s) => ({ ...s, ...p }))}
      />

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(260px, 22%) 1fr",
        }}
      >
        {/* TL Column */}
        <div
          style={{
            minHeight: 480,
            borderRadius: 16,
            border: "1px solid var(--divider)",
            background: "var(--card)",
            padding: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{t.tls}</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* All Team button */}
            <button
              type="button"
              onClick={() => setFilters((s) => ({ ...s, teamLeaderId: "ALL" }))}
              style={{
                ...pillBtnStyle,
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              {isArabic ? "كل الفريق" : "All Team"}
            </button>

            {/* TLs list */}
            {tls.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setFilters((s) => ({ ...s, teamLeaderId: u.id }))}
                style={{
                  ...pillBtnStyle,
                  justifyContent: "space-between",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(isArabic ? u.arabic_name : u.name) || u.username || "—"}
                </span>
                <span style={{ opacity: 0.6 }}>▾</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Cascading */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Users */}
          <Panel title={t.users} right={<PillCount n={users.length} />}>
            {users.length === 0 ? (
              <EmptyBox text={t.pickTL} />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                }}
              >
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUser(u.id)}
                    style={{
                      ...pillBtnStyle,
                      height: 64,
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: isArabic ? "right" : "left" }}>
                      <span style={{ fontWeight: 700 }}>
                        {(isArabic ? u.arabic_name : u.name) || u.username || "—"}
                      </span>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>{u.role || "—"}</span>
                    </div>
                    <span style={{ opacity: 0.6 }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          {/* Markets */}
          <Panel title={t.markets} right={<PillCount n={markets.length} />}>
            {!selectedUser ? (
              <EmptyBox text={t.pickUser} />
            ) : markets.length === 0 ? (
              <EmptyBox text={t.noMarkets} />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                }}
              >
                {markets.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMarket(m.id)}
                    style={{ ...pillBtnStyle, height: 56, justifyContent: "space-between" }}
                  >
                    <span style={{ fontWeight: 700 }}>{m.name}</span>
                    <span style={{ opacity: 0.6 }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          {/* Visits */}
          <Panel title={t.visits} right={<PillCount n={visits.length} />}>
            {!selectedMarket ? (
              <EmptyBox text={t.pickMarket} />
            ) : visits.length === 0 ? (
              <EmptyBox text={t.noVisits} />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    minWidth: 720,
                    borderCollapse: "collapse",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <thead>
                    <tr style={{ background: "var(--input-bg)", color: "var(--text)" }}>
                      {["ID", isArabic ? "البدء" : "Start", isArabic ? "الانتهاء" : "Finish", isArabic ? "الحالة" : "Status", isArabic ? "اليومي" : "Snapshot", ""].map(
                        (h) => (
                          <th key={h} style={{ textAlign: "start", fontSize: 12, padding: "8px 10px", borderBottom: "1px solid var(--divider)" }}>
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => {
                      const st = v.snapshot?.status || v.status || "—";
                      const started = v.started_at ? new Date(v.started_at).toLocaleString() : "—";
                      const finished = v.finished_at ? new Date(v.finished_at).toLocaleString() : "—";
                      const snapDate = v.snapshot ? new Date(v.snapshot.snapshot_date).toLocaleDateString() : "—";
                      return (
                        <tr key={v.id} style={{ borderBottom: "1px solid var(--divider)" }}>
                          <td style={tdStyle}>{String(v.id).slice(0, 8)}…</td>
                          <td style={tdStyle}>{started}</td>
                          <td style={tdStyle}>{finished}</td>
                          <td style={tdStyle}>{st}</td>
                          <td style={tdStyle}>{snapDate}</td>
                          <td style={{ ...tdStyle, textAlign: "end" }}>
                            <button
                              type="button"
                              onClick={() => setSelectedVisit(v.id)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 10,
                                border: "1px solid var(--divider)",
                                background: "var(--card)",
                                color: "var(--text)",
                                cursor: "pointer",
                              }}
                            >
                              {t.details}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Steps placeholder */}
          <Panel title={t.steps}>
            {!selectedVisit ? (
              <EmptyBox text={t.pickVisit} />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                }}
              >
                {["Arrival", "Availability", "WH", "Damage", "SOS", "Competitor", "Remarks"].map((s) => (
                  <div
                    key={s}
                    style={{
                      border: "1px solid var(--input-border)",
                      background: "var(--input-bg)",
                      color: "var(--text)",
                      borderRadius: 12,
                      padding: "8px 12px",
                      textAlign: "center",
                      fontSize: 13,
                    }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Back */}
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <Link
              href="/admin/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid var(--divider)",
                background: "var(--card)",
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              {t.back}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========= Small sub-components ========= */
function EmptyBox({ text }: { text: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--divider)",
        background: "var(--input-bg)",
        color: "var(--text)",
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

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13,
  color: "var(--text)",
};
