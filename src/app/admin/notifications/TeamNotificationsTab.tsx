"use client";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import RecipientDrawer from "./RecipientDrawer";
import { useLangTheme } from "@/hooks/useLangTheme";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type NotiRow = {
  id: string;
  created_at: string | null;
  client_id: string | null;
  title_ar: string | null;
  title_en: string | null;
  message_ar: string | null;
  message_en: string | null;
  team_leader: string | null;
  for_all: boolean | null;
  for_roles: string[] | null;
  for_user: string[] | null;
  for_user_single: string | null;
  completed_by: string[] | null;
  status: string | null;
  completed_at: string | null;
};

type UserMini = { id: string; username: string | null; arabic_name: string | null };

export default function TeamNotificationsTab({ clientId }: { clientId: string | null }) {
  const { isArabic } = useLangTheme();

  // فلاتر
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [scope, setScope] = useState<"" | "ALL" | "ROLES" | "USERS">("");
  const [doneFilter, setDoneFilter] = useState<"" | "done" | "pending">("");

  // بيانات
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<NotiRow[]>([]);
  const [userInfoById, setUserInfoById] = useState<Record<string, { en?: string; ar?: string }>>(
    {}
  );

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [selected, setSelected] = useState<NotiRow | null>(null);

  /* ===== منطقيات التاريخ: From ≤ To ===== */
  const onFromChange = (v: string) => {
    setDateFrom(v);
    if (dateTo && v) {
      const from = new Date(v);
      const to = new Date(dateTo);
      if (from > to) setDateTo(v);
    }
  };
  const onToChange = (v: string) => {
    setDateTo(v);
    if (dateFrom && v) {
      const from = new Date(dateFrom);
      const to = new Date(v);
      if (to < from) setDateFrom(v);
    }
  };

  const setFullYear = () => {
    const y = new Date().getFullYear();
    setDateFrom(`${y}-01-01`);
    setDateTo(`${y}-12-31`);
  };

  // بدّل دالة clearFilters
const clearFilters = useCallback(() => {
  setDateFrom("");
  setDateTo("");
  setScope("");
  setDoneFilter("");
}, []);

  const formatKSA = (iso: string | null) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString("en-GB", {
        timeZone: "Asia/Riyadh",
        hour12: true,
      });
    } catch {
      return iso ?? "-";
    }
  };

  const displayName = (userId?: string | null) => {
    if (!userId) return "-";
    const info = userInfoById[String(userId)];
    if (!info) return String(userId);
    return isArabic ? info.ar || info.en || String(userId) : info.en || info.ar || String(userId);
  };

  /* ===== تحميل القائمة ===== */
  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("Notifications")
      .select(
        "id,created_at,client_id,title_ar,title_en,message_ar,message_en,team_leader,for_all,for_roles,for_user,for_user_single,completed_by,status,completed_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (clientId) q = q.eq("client_id", clientId);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    if (dateTo) q = q.lte("created_at", dateTo);

    const { data, error } = await q;
    if (!error && data) {
      let filtered = data as NotiRow[];

      if (scope) {
        filtered = filtered.filter((n) => {
          const hint =
            n.for_all
              ? "ALL"
              : n.for_user_single || (n.for_user && n.for_user.length > 0)
              ? "USERS"
              : n.for_roles && n.for_roles.length > 0
              ? "ROLES"
              : "UNKNOWN";
          return hint === scope;
        });
      }

      if (doneFilter) {
        filtered = filtered.filter((n) => {
          const done = (n.completed_by?.length ?? 0) > 0;
          return doneFilter === "done" ? done : !done;
        });
      }

      setRows(filtered);
    } else {
      setRows([]);
    }
    setLoading(false);
  }, [clientId, dateFrom, dateTo, scope, doneFilter]);

  useEffect(() => {
    load();
  }, [load]);

  /* ===== تحميل أسماء المرسل/المستلمين عربي/إنجليزي ===== */
  useEffect(() => {
    (async () => {
      const idsSet = new Set<string>();
      for (const r of rows) {
        if (r.team_leader) idsSet.add(String(r.team_leader));
        if (r.for_user_single) idsSet.add(String(r.for_user_single));
        (r.for_user ?? []).forEach((u) => idsSet.add(String(u)));
      }
      const ids = Array.from(idsSet);
      if (ids.length === 0) {
        setUserInfoById({});
        return;
      }

      const { data } = await supabase.from("Users").select("id,username,arabic_name").in("id", ids);

      const map: Record<string, { en?: string; ar?: string }> = {};
      ((data as UserMini[]) || []).forEach((u) => {
        map[String(u.id)] = { en: u.username || undefined, ar: u.arabic_name || undefined };
      });
      setUserInfoById(map);
    })();
  }, [rows]);

  /* ===== Render helpers ===== */
  const renderRecipients = (n: NotiRow): string => {
    if (n.for_user_single) {
      return displayName(n.for_user_single);
    }
    if (n.for_user && n.for_user.length > 0) {
      const names = n.for_user.map((id) => displayName(String(id)));
      if (names.length <= 3) return names.join(", ");
      return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
    }
    if (n.for_roles && n.for_roles.length > 0) {
      return (n.for_roles as string[]).join(", ");
    }
    if (n.for_all) {
      return isArabic ? "كل الشركة" : "All company";
    }
    return "-";
  };

  /* ===== UI ===== */
  return (
    <div>
      {/* Filters header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex" }}>
          <button onClick={load} style={btnRectPrimary}>
            {isArabic ? "تحديث" : "Refresh"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Cap label={isArabic ? "النوع" : "Scope"}>
            <select
              className="light-dropdown"
              value={scope}
              onChange={(e) => setScope(e.target.value as "" | "ALL" | "ROLES" | "USERS")}
              style={{ minWidth: 130 }}
            >
              <option value="">{isArabic ? "الكل" : "All"}</option>
              <option value="USERS">{isArabic ? "مستخدم/مستخدمون" : "Users"}</option>
              <option value="ROLES">{isArabic ? "أدوار" : "Roles"}</option>
              <option value="ALL">{isArabic ? "كل الشركة" : "All company"}</option>
            </select>
          </Cap>

          <Cap label={isArabic ? "من" : "From"}>
            <DateField
              value={dateFrom}
              onChange={onFromChange}
              placeholder={isArabic ? "يوم - شهر - سنة" : "dd - mm - yyyy"}
            />
          </Cap>

          <Cap label={isArabic ? "إلى" : "To"}>
            <DateField
              value={dateTo}
              onChange={onToChange}
              placeholder={isArabic ? "يوم - شهر - سنة" : "dd - mm - yyyy"}
            />
          </Cap>

          <Cap label={isArabic ? "اختصار" : "Quick"}>
            <select
              className="light-dropdown"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v === "FULL_YEAR") setFullYear();
                else if (v === "COMPLETED") setDoneFilter("done");
                else if (v === "PENDING") setDoneFilter("pending");
                e.currentTarget.selectedIndex = 0;
              }}
              style={{ minWidth: 150 }}
            >
              <option value="">{isArabic ? "اختر…" : "Choose…"}</option>
              <option value="COMPLETED">{isArabic ? "المكتملة" : "Completed"}</option>
              <option value="PENDING">{isArabic ? "المعلقة" : "Pending"}</option>
              <option value="FULL_YEAR">{isArabic ? "سنة كاملة" : "Full year"}</option>
            </select>
          </Cap>

          <button onClick={clearFilters} style={btnRect}>
            {isArabic ? "جميع الإشعارات" : "All notifications"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid var(--divider)", borderRadius: 12 }}>
        <table
          style={{
            width: "100%",
            fontSize: 14,
            borderCollapse: "separate",
            borderSpacing: 0,
          }}
        >
          <thead style={{ background: "var(--header-bg)", color: "var(--header-fg)" }}>
            <tr>
              <Th> {isArabic ? "العنوان" : "Title"} </Th>
              <Th> {isArabic ? "المرسل" : "Sender"} </Th>
              <Th> {isArabic ? "المستلم/ين" : "Recipient(s)"} </Th>
              <Th> {isArabic ? "النطاق" : "Scope"} </Th>
              <Th> {isArabic ? "أُرسلت في" : "Sent At"} </Th>
              <Th> {isArabic ? "أُكملت في" : "Completed At"} </Th>
              <Th> {isArabic ? "مكتمل" : "Completed"} </Th>
              <Th> {isArabic ? "تفاصيل" : "Details"} </Th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <Td colSpan={8}>{isArabic ? "جارِ التحميل…" : "Loading…"}</Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td colSpan={8}>{isArabic ? "لا توجد إشعارات" : "No notifications"}</Td>
              </tr>
            ) : (
              rows.map((n) => {
                const scopeHint =
                  n.for_all
                    ? "ALL"
                    : n.for_user_single || (n.for_user && n.for_user.length > 0)
                    ? "USERS"
                    : n.for_roles && n.for_roles.length > 0
                    ? "ROLES"
                    : "UNKNOWN";

                const done = (n.completed_by?.length ?? 0) > 0;

                // العنوان فقط (EN + AR لو موجودين)
                const titleEn = (n.title_en ?? "").trim();
                const titleAr = (n.title_ar ?? "").trim();
                const hasAnyTitle = !!(titleEn || titleAr);

                return (
                  <tr key={n.id} style={{ background: "var(--bg)" }}>
                    <Td style={{ maxWidth: 460, padding: "10px 16px" }}>
                      <div style={{ ...titleBox, padding: "10px 12px" }}>
                        {!hasAnyTitle ? (
                          <div style={titleHeading}>-</div>
                        ) : (
                          <>
                            {titleEn && (
                              <div
                                style={{
                                  ...titleHeading,
                                  direction: "ltr",
                                  textAlign: "left",
                                }}
                              >
                                {titleEn}
                              </div>
                            )}
                            {titleAr && (
                              <div
                                style={{
                                  ...titleHeading,
                                  direction: "rtl",
                                  textAlign: "right",
                                }}
                              >
                                {titleAr}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </Td>

                    <Td>{displayName(n.team_leader)}</Td>
                    <Td>{renderRecipients(n)}</Td>
                    <Td>
                      <span style={badge}>{scopeHint}</span>
                    </Td>
                    <Td>{formatKSA(n.created_at)}</Td>
                    <Td>{formatKSA(n.completed_at)}</Td>
                    <Td style={{ fontWeight: 800, textAlign: "center" }}>{done ? "✓" : "—"}</Td>
                    <Td>
                      <button
                        style={btnGhost}
                        onClick={() => {
                          setSelected(n);
                          setDrawerOpen(true);
                        }}
                      >
                        {isArabic ? "عرض" : "View"}
                      </button>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <RecipientDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          notification={selected}
          clientId={clientId}
        />
      )}
    </div>
  );
}

/* ===== DateField ===== */
function DateField({
  value,
  onChange,
  placeholder = "dd - mm - yyyy",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  type HTMLInputWithPicker = HTMLInputElement & { showPicker?: () => void };

  const formatDMY = (v: string) => {
    if (!v) return placeholder;
    const [y, m, d] = v.split("-");
    const dd = (d || "").padStart(2, "0");
    const mm = (m || "").padStart(2, "0");
    return `${dd} - ${mm} - ${y}`;
  };

  const openPicker = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const el = ref.current as HTMLInputWithPicker | null;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.click();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseDown={openPicker}
      onTouchStart={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") openPicker(e);
      }}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        minWidth: 180,
        cursor: "pointer",
      }}
      title={placeholder}
    >
      <input
        ref={ref}
        type="date"
        className="date-dark no-native"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          color: "transparent",
          caretColor: "transparent",
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          borderRadius: 12,
          padding: "10px 12px",
          minHeight: 38,
          pointerEvents: "none",
        }}
      />
      <span
        style={{
          position: "absolute",
          insetInlineStart: 12,
          insetInlineEnd: 12,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: value ? "var(--input-text)" : "var(--input-placeholder)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {formatDMY(value)}
      </span>
    </div>
  );
}

/* ===== UI helpers & styles ===== */
function Cap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--divider)",
        borderRadius: 999,
        padding: "4px 8px",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
      {children}
    </div>
  );
}

/* Sticky header cell */
const Th = (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    style={{
      position: "sticky",
      top: 0,
      zIndex: 5,
      background: "var(--header-bg)",
      color: "var(--header-fg)",       // ← بدل var(--text) أو خلّيها "inherit"
      textAlign: "start",
      padding: 10,
      borderBottom: "1px solid var(--divider)",
    }}
    {...props}
  />
);

const Td = (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td style={{ padding: 10, borderBottom: "1px solid var(--divider)", verticalAlign: "top" }} {...props} />
);

/* Buttons */
const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "var(--text)",
  border: "1px solid var(--divider)",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 13,
  cursor: "pointer",
};
const btnRectPrimary: React.CSSProperties = {
  ...btnPrimary,
  padding: "10px 14px",
  minWidth: 120,
};
const btnRect: React.CSSProperties = {
  ...btnGhost,
  padding: "10px 12px",
  minWidth: 130,
};
const badge: React.CSSProperties = {
  background: "var(--chip-bg)",
  padding: "3px 8px",
  borderRadius: 12,
  border: "1px solid var(--divider)",
  fontSize: 12,
};

/* كارت العنوان داخل الخلية */
const titleBox: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--divider)",
  borderRadius: 10,
  background: "color-mix(in oklab, var(--card) 92%, transparent)",
};
const titleHeading: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
  lineHeight: 1.35,
};
