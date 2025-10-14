"use client";
import type React from "react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import RecipientDrawer from "./RecipientDrawer";
import { useLangTheme } from "@/hooks/useLangTheme";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/* ========== Types ========== */
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
  status: string | null; // PENDING, COMPLETED, NEW, etc.
  completed_at: string | null; // وقت إكمال الطلب (العام)
};

type UserMini = { id: string; username: string | null; arabic_name: string | null };

/* ========== Utils ========== */

// دالة لحساب وتنسيق المدة الزمنية
function fmtDuration(start?: string | null, end?: string | null): string {
    if (!start || !end) return "—";
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();

    if (isNaN(startTime) || isNaN(endTime) || endTime < startTime) return "—";

    const diffSeconds = Math.floor((endTime - startTime) / 1000);

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    // إذا لم تكن هناك ساعات أو دقائق، نعرض الثواني مباشرة
    if (parts.length === 0) return `${diffSeconds}s`; 
    
    return parts.join(' ');
}


export default function TeamNotificationsTab({ clientId }: { clientId: string | null }) {
  const { isArabic } = useLangTheme();

  // فلاتر
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [senderFilter, setSenderFilter] = useState<"" | "TL" | "ADMIN">(""); 
  const [notiTypeFilter, setNotiTypeFilter] = useState<"" | "ALL" | "ROLES" | "USERS">(""); 
  const [statusFilter, setStatusFilter] = useState<"" | "COMPLETED" | "PENDING">(""); 

  // بيانات
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<NotiRow[]>([]);
  const [userInfoById, setUserInfoById] = useState<Record<string, { en?: string; ar?: string; role?: string }>>(
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

  // دالة إعادة التعيين
const clearFilters = useCallback(() => {
  setDateFrom("");
  setDateTo("");
  setSenderFilter("");
  setNotiTypeFilter("");
  setStatusFilter("");
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

  /* ===== تحميل المرسلين (Fetch Senders) - تم تبسيط الدالة ===== */
  const fetchSenders = useCallback(async () => {
      if (!clientId) return;
  }, [clientId]);


  /* ===== تحميل القائمة - جلب كل الإشعارات مع فلترة التاريخ ===== */
  const load = useCallback(async () => {
    setLoading(true);
    
    let q = supabase
      .from("Notifications")
      .select(
        "id,created_at,client_id,title_ar,title_en,message_ar,message_en,team_leader,for_all,for_roles,for_user,for_user_single,completed_by,status,completed_at"
      )
      .order("created_at", { ascending: false })
      .limit(500); 

    if (clientId) q = q.eq("client_id", clientId);
    
    // شروط التاريخ (تتم في الـ Backend)
    if (dateFrom) q = q.gte("created_at", dateFrom);
    if (dateTo) q = q.lte("created_at", dateTo);

    // ⚠️ لا يتم فلترة المرسل أو الحالة هنا لضمان جلب البيانات ومنع التعارض ⚠️
    
    const { data, error } = await q;
    if (!error && data) {
      setRows(data as NotiRow[]);
    } else {
      setRows([]);
    }
    setLoading(false);
  }, [clientId, dateFrom, dateTo]); // ⚠️ تم إزالة notiTypeFilter و statusFilter من dependencies هنا

  useEffect(() => {
    if (clientId) fetchSenders();
  }, [clientId, fetchSenders]);
  
  useEffect(() => {
    load();
  }, [load]);

  /* ===== تحميل أسماء المرسل/المستلمين عربي/إنجليزي - مع جلب الدور ===== */
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

      const { data } = await supabase.from("Users").select("id,username,arabic_name,role").in("id", ids);

      const map: Record<string, { en?: string; ar?: string; role?: string }> = {};
      ((data as (UserMini & {role: string})[]) || []).forEach((u) => {
        map[String(u.id)] = { 
            en: u.username || undefined, 
            ar: u.arabic_name || undefined, 
            role: u.role 
        };
      });
      setUserInfoById(map);
    })();
  }, [rows]);
  
  // 🚨 useMemo: تطبيق جميع فلاتر Frontend هنا (المرسل، النوع، الحالة) 🚨
  const finalRows = useMemo(() => {
      let filtered = rows;
      
      // 1. فلترة المرسل 
      if (senderFilter) {
          filtered = filtered.filter(n => {
              const senderInfo = userInfoById[String(n.team_leader)];
              const senderRole = senderInfo?.role?.toLowerCase();
              
              if (!senderRole) return false; 
              
              if (senderFilter === "TL") {
                  return senderRole.includes('team_leader');
              }
              if (senderFilter === "ADMIN") {
                  return senderRole.includes('admin');
              }
              
              return false; 
          });
      }
      
      // 2. فلترة النوع
      if (notiTypeFilter) {
        filtered = filtered.filter((n) => {
          const hint =
            n.for_all
              ? "ALL"
              : n.for_user_single || (n.for_user && n.for_user.length > 0)
              ? "USERS"
              : n.for_roles && n.for_roles.length > 0
              ? "ROLES"
              : "UNKNOWN";
          return hint === notiTypeFilter;
        });
      }
      
      // 3. فلترة الحالة (تطبيق المنطق المطلوب الآن)
      if (statusFilter) {
          filtered = filtered.filter(n => {
              // المنطق المرن للإكمال الكلي: فرد واحد نفذ أو Status = COMPLETED
              const isTargetingSingleUser = 
                  (n.for_user && n.for_user.length === 1 && !n.for_roles && !n.for_all) || 
                  (!!n.for_user_single && !n.for_roles && !n.for_all);
              const hasBeenCompletedByOne = (n.completed_by?.length ?? 0) >= 1;
              const isCompleteForAll = (isTargetingSingleUser && hasBeenCompletedByOne) || n.status === "COMPLETED"; 

              // isPartialOrPending: أي شيء ليس مكتمل كلياً
              const isPartialOrPending = !isCompleteForAll; 

              if (statusFilter === "COMPLETED") {
                  return isCompleteForAll; // يجلب المكتمل كلياً
              }
              if (statusFilter === "PENDING") {
                  return isPartialOrPending; // يجلب المكتمل جزئياً والغير مكتمل
              }
              return false;
          });
      }
      
      return filtered;
      
  }, [rows, userInfoById, senderFilter, notiTypeFilter, statusFilter]);


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
          gap: 12, 
          flexWrap: "wrap",
          justifyContent: "flex-start", 
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex" }}>
          <button onClick={load} style={btnRectPrimary}>
            {isArabic ? "تحديث" : "Refresh"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          
          {/* 🌟 فلتر المرسل 🌟 */}
          <CapsuleItem label={isArabic ? "المرسل" : "Sender"}>
            <select
              className="capsule-select" 
              value={senderFilter}
              onChange={(e) => setSenderFilter(e.target.value as "" | "TL" | "ADMIN")}
              style={capsuleSelectStyle}
            >
              <option value="">{isArabic ? "الكل" : "All"}</option>
              <option value="TL">{isArabic ? "قائد فريق" : "Team Leader"}</option>
              <option value="ADMIN">{isArabic ? "مسؤول" : "Admin"}</option>
            </select>
          </CapsuleItem>
          
          {/* 🌟 فلتر نوع الإشعار 🌟 */}
          <CapsuleItem label={isArabic ? "النوع" : "Type"}>
            <select
              className="capsule-select"
              value={notiTypeFilter}
              onChange={(e) => setNotiTypeFilter(e.target.value as "" | "ALL" | "ROLES" | "USERS")}
              style={capsuleSelectStyle}
            >
              <option value="">{isArabic ? "الكل" : "All"}</option>
              <option value="USERS">{isArabic ? "مستخدم/ون" : "Users"}</option>
              <option value="ROLES">{isArabic ? "أدوار" : "Roles"}</option>
              <option value="ALL">{isArabic ? "كل الشركة" : "All Company"}</option>
            </select>
          </CapsuleItem>

          {/* 🌟 فلتر حالة الإشعار 🌟 */}
          <CapsuleItem label={isArabic ? "الحالة" : "Status"}>
            <select
              className="capsule-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "COMPLETED" | "PENDING")}
              style={capsuleSelectStyle}
            >
              <option value="">{isArabic ? "الكل" : "All"}</option>
              <option value="COMPLETED">{isArabic ? "مكتملة" : "Completed"}</option>
              <option value="PENDING">{isArabic ? "معلقة" : "Pending"}</option>
            </select>
          </CapsuleItem>

          {/* فلتر التاريخ من */}
          <CapsuleItem label={isArabic ? "من" : "From"}>
            <DateField
              value={dateFrom}
              onChange={onFromChange}
              placeholder={isArabic ? "اختر تاريخ" : "Select Date"}
            />
          </CapsuleItem>

          {/* فلتر التاريخ إلى */}
          <CapsuleItem label={isArabic ? "إلى" : "To"}>
            <DateField
              value={dateTo}
              onChange={onToChange}
              placeholder={isArabic ? "اختر تاريخ" : "Select Date"}
            />
          </CapsuleItem>

          {/* زر إعادة التعيين */}
          <button onClick={clearFilters} style={btnRect}>
            {isArabic ? "إعادة تعيين" : "Reset Filters"}
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
              
              {/* عمود الوقت المستغرق */}
              <Th> {isArabic ? "الوقت المستغرق" : "Time Taken"} </Th>
              
              <Th> {isArabic ? "تفاصيل" : "Details"} </Th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <Td colSpan={9}>{isArabic ? "جارِ التحميل…" : "Loading…"}</Td>
              </tr>
            ) : finalRows.length === 0 ? (
              <tr>
                <Td colSpan={9}>{isArabic ? "لا توجد إشعارات" : "No notifications"}</Td>
              </tr>
            ) : (
              finalRows.map((n) => {
                const scopeHint =
                  n.for_all
                    ? "ALL"
                    : n.for_user_single || (n.for_user && n.for_user.length > 0)
                    ? "USERS"
                    : n.for_roles && n.for_roles.length > 0
                    ? "ROLES"
                    : "UNKNOWN";

                // 🌟 المنطق المرن للإكمال الكلي 🌟
                const isTargetingSingleUser = 
                    (n.for_user && n.for_user.length === 1 && !n.for_roles && !n.for_all) || 
                    (!!n.for_user_single && !n.for_roles && !n.for_all);

                const hasBeenCompletedByOne = (n.completed_by?.length ?? 0) >= 1;

                const isSingleAndDone = isTargetingSingleUser && hasBeenCompletedByOne;
                const isCompleteForAll = isSingleAndDone || n.status === "COMPLETED"; 
                
                // حالة العرض في العمود
                const doneDisplay = isCompleteForAll ? "✓" : "—";
                
                // حساب الوقت المستغرق
                const timeTaken = isCompleteForAll 
                  ? fmtDuration(n.created_at, n.completed_at) 
                  : "—";

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
                    
                    {/* عمود مكتمل: يعرض الحالة الكلية */}
                    <Td style={{ fontWeight: 800, textAlign: "center", color: isCompleteForAll ? 'var(--green, #10B981)' : 'var(--muted)' }}>
                      {doneDisplay}
                    </Td>
                    
                    {/* عمود الوقت المستغرق (في الموضع الجديد) */}
                    <Td>{timeTaken}</Td> 

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
      
      {/* 💡 أنماط CSS المكملة - تم وضعها في النهاية 💡 */}
      <GlobalStyles />
    </div>
  );
}

/* ===== DateField (باستخدام سلاسل نصية) ===== */
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
  return '';
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
        height: 38, // تثبيت الارتفاع ليتناسب مع تصميم الكبسولة
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
          background: "transparent", // أصبح شفافاً ليعتمد على خلفية الكبسولة
          border: "none", // إزالة الحدود
          borderRadius: 12,
          padding: "0 12px",
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
          color: value ? "var(--text)" : "var(--muted)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: 13, // ليتناسب مع باقي الفلاتر
        }}
      >
        {formatDMY(value)}
      </span>
    </div>
  );
}

/* ===== UI helpers & styles (مُعدَّلة لتناسب تصميم الكبسولة) ===== */
function CapsuleItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={capsuleItemShell}>
      <span style={capsuleItemLabel}>{label}</span>
      <span style={capsuleItemChevron}>▾</span>
      {children}
    </div>
  );
}

// 🌟 أنماط الكبسولة الجديدة (مقتبسة من الداشبورد) 🌟
const capsuleItemShell: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--card)", 
    border: "1px solid var(--divider)", 
    borderRadius: 9999,
    padding: "6px 10px", 
    whiteSpace: "nowrap",
    minHeight: 38,
};

const capsuleItemLabel: React.CSSProperties = {
    fontSize: 12,
    color: "var(--muted)",
    whiteSpace: "nowrap",
};

const capsuleItemChevron: React.CSSProperties = {
    fontSize: 10,
    opacity: 0.7,
    marginInlineStart: 2,
};

// 🌟 النمط المباشر لعنصر select 🌟
const capsuleSelectStyle: React.CSSProperties = {
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "var(--text)",
    fontSize: 13,
    minWidth: 110,
};


/* Sticky header cell */
const Th = (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    style={{
      position: "sticky",
      top: 0,
      zIndex: 5,
      background: "var(--header-bg)",
      color: "var(--header-fg)",
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
  // أصبح زر "إعادة التعيين"
  background: "var(--card)", 
  color: "var(--text)",
  border: "1px solid var(--divider)",
  borderRadius: 10, 
  padding: "10px 12px",
  minWidth: 130,
  fontWeight: 700,
  cursor: "pointer",
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

/* 💡 أنماط CSS المكملة */
const GlobalStyles = () => (
    <style jsx global>{`
        .capsule-select {
            appearance: none;
            padding-inline-end: 14px;
        }
        .capsule-select option {
            color: #000;
            background: #fff;
        }
    `}</style>
);