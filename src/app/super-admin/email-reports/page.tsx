"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useLangTheme } from "@/hooks/useLangTheme";

/* ========= Types ========= */
type UUID = string;

type ReportFilters =
  | {
      region?: string;
      city?: string;
      store?: string;
      team_leader_id?: string;
      status?: string;
    }
  | null;

type ScheduledReport = {
  id: string;
  created_at: string;
  recipient_email: string;
  filters: ReportFilters;
  is_active: boolean;
  client_id: string | null;
};

type UserLite = {
  id: UUID;
  name: string | null;
  arabic_name: string | null;
  role?: string | null;
};

type ClientLite = { id: UUID; name: string | null; arabic_name: string | null };

/* ========= Page ========= */
export default function ManageEmailReportsPage() {
  const { isArabic } = useLangTheme();

  // UI
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);

  // Super Admin
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Clients
  const [clientId, setClientId] = useState<string | null>(null);
  const [allClients, setAllClients] = useState<ClientLite[]>([]);
  const [isClientsLoading, setIsClientsLoading] = useState(true);

  // Form
  const [isSaving, setIsSaving] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");

  // Filter selections
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedTL, setSelectedTL] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Filter options
  const [allTeamLeaders, setAllTeamLeaders] = useState<UserLite[]>([]);
  const [allRegions, setAllRegions] = useState<string[]>([]);
  const [allCities, setAllCities] = useState<string[]>([]);
  const [allStores, setAllStores] = useState<string[]>([]);

  // Users map (لعرض اسم/دور بدل UUID داخل جدول الفلاتر)
  const [usersMap, setUsersMap] = useState<Map<string, UserLite>>(new Map());

  // Texts
  const T = {
    title: isArabic ? "إدارة التقارير البريدية" : "Manage Email Reports",
    client: isArabic ? "العميل" : "Client",
    pickClient: isArabic ? "اختر العميل..." : "Select a client...",
    allClients: isArabic ? "الكل" : "All Clients",
    currentSchedules: isArabic ? "التقارير المجدولة حاليًا" : "Current Scheduled Reports",
    addNew: isArabic ? "إضافة تقرير مجدول جديد" : "Add New Scheduled Report",
    recipientEmail: isArabic ? "البريد الإلكتروني للمستلم" : "Recipient Email",
    filters: isArabic ? "الفلاتر" : "Filters",
    save: isArabic ? "حفظ" : "Save",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    loading: isArabic ? "تحميل..." : "Loading...",
    noSchedules: isArabic ? "لا توجد تقارير مجدولة حاليًا." : "No scheduled reports yet.",
    region: isArabic ? "المنطقة" : "Region",
    city: isArabic ? "المدينة" : "City",
    store: isArabic ? "السوق" : "Store",
    tl: isArabic ? "قائد الفريق" : "Team Leader",
    status: isArabic ? "الحالة" : "Status",
    all: isArabic ? "الكل" : "All",
    recipient: isArabic ? "المستلم" : "Recipient",
    appliedFilters: isArabic ? "الفلاتر المطبقة" : "Applied Filters",
    rowStatus: isArabic ? "الحالة" : "Status",
    actions: isArabic ? "إجراءات" : "Actions",
    delete: isArabic ? "حذف" : "Delete",
    activate: isArabic ? "تفعيل" : "Activate",
    deactivate: isArabic ? "إيقاف" : "Deactivate",
    mustPickClient: isArabic ? "من فضلك اختر العميل أولاً." : "Please select a client first.",
    savedOk: isArabic ? "تم حفظ التقرير المجدول بنجاح!" : "Scheduled report saved successfully!",
    saveFail: (m: string) => (isArabic ? `فشل حفظ التقرير: ${m}` : `Failed to save schedule: ${m}`),
    toggledOk: isArabic ? "تم تحديث الحالة." : "Status updated.",
    toggledFail: (m: string) => (isArabic ? `فشل التحديث: ${m}` : `Failed to update: ${m}`),
    deletedOk: isArabic ? "تم الحذف." : "Deleted.",
    deletedFail: (m: string) => (isArabic ? `فشل الحذف: ${m}` : `Failed to delete: ${m}`),
    confirmDelete: isArabic ? "متأكد انك عايز تحذف التقرير؟" : "Are you sure you want to delete this report?",
    filtersDisabled: isArabic ? "اختر عميلًا لإظهار فلاتره." : "Pick a client to see its filters.",
  };

  // Styles
  const thStyle: React.CSSProperties = { textAlign: "center", padding: "12px 10px", fontWeight: 800, borderBottom: "1px solid var(--divider)" };
  const tdStyle: React.CSSProperties = { textAlign: "center", padding: "12px 10px" };
  const selectStyle: React.CSSProperties = { width: "100%", padding: 8, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)", borderRadius: 4 };
  const sortAr = (a: string, b: string) => a.localeCompare(b, "ar");

  const resetFilterSelections = () => {
    setSelectedRegion("");
    setSelectedCity("");
    setSelectedStore("");
    setSelectedTL("");
    setSelectedStatus("");
  };

  /* ===== Fetchers ===== */

  const fetchSchedules = useCallback(
    async (cid: string | null, superMode = false) => {
      setLoading(true);
      let q = supabase.from("scheduled_email_reports").select("*").order("created_at", { ascending: false });

      // سوبر أدمن + الكل ⇒ هات الكل
      if (!(superMode && (cid === "__ALL__" || !cid))) {
        q = q.eq("client_id", cid as string);
      }

      const { data, error } = await q.throwOnError();
      if (error) {
        console.error("Error fetching schedules:", error);
        setSchedules([]);
      } else {
        setSchedules((data as ScheduledReport[]) || []);
      }
      setLoading(false);
    },
    []
  );

  // يجيب مستخدمين لتخزينهم في usersMap (لعرض الاسم/الدور بدل UUID في الجدول)
  const fetchUsersMap = useCallback(
    async (cid: string | null, superMode = false) => {
      try {
        if (superMode && (cid === "__ALL__" || !cid)) {
          const { data } = await supabase.from("Users").select("id, name, arabic_name, role").limit(2000).throwOnError();
          setUsersMap(new Map((data as UserLite[]).map((u) => [u.id, u])));
          setAllTeamLeaders(data as UserLite[]);
          return;
        }

        if (!cid) {
          setUsersMap(new Map());
          setAllTeamLeaders([]);
          return;
        }

        const { data: clientUsers } = await supabase.from("client_users").select("user_id").eq("client_id", cid).throwOnError();
        if (!clientUsers?.length) {
          setUsersMap(new Map());
          setAllTeamLeaders([]);
          return;
        }

        const ids = clientUsers.map((x: { user_id: string }) => x.user_id);
        const { data: users } = await supabase.from("Users").select("id, name, arabic_name, role").in("id", ids).throwOnError();
        setUsersMap(new Map((users as UserLite[]).map((u) => [u.id, u])));
        setAllTeamLeaders(users as UserLite[]);
      } catch (e) {
        console.error("fetchUsersMap error:", e);
        setUsersMap(new Map());
        setAllTeamLeaders([]);
      }
    },
    []
  );

  // فلاتر العميل (Regions/Cities/Stores)
  const fetchFilterOptionsForClient = useCallback(async (cid: string) => {
    try {
      const { data: clientMarketsData } = await supabase
        .from("client_markets")
        .select("market_id")
        .eq("client_id", cid)
        .throwOnError();

      if (!clientMarketsData?.length) {
        setAllRegions([]);
        setAllCities([]);
        setAllStores([]);
        return;
      }

      const marketIds = clientMarketsData.map((cm: { market_id: string }) => cm.market_id);
      const { data: marketsData } = await supabase.from("Markets").select("region, city, store").in("id", marketIds).throwOnError();

      const regions = new Set<string>();
      const cities = new Set<string>();
      const stores = new Set<string>();
      (marketsData || []).forEach((m: { region: string | null; city: string | null; store: string | null }) => {
        if (m.region) regions.add(m.region);
        if (m.city) cities.add(m.city);
        if (m.store) stores.add(m.store);
      });

      setAllRegions(Array.from(regions).sort(sortAr));
      setAllCities(Array.from(cities).sort(sortAr));
      setAllStores(Array.from(stores).sort(sortAr));
    } catch (e) {
      console.error("fetchFilterOptionsForClient error:", e);
      setAllRegions([]);
      setAllCities([]);
      setAllStores([]);
    }
  }, []);

  // العملاء المتاحين — بدون أي typing معقّد
  const fetchAvailableClients = useCallback(async (role?: string) => {
    setIsClientsLoading(true);
    let clientList: ClientLite[] = [];

    // helper: select مع/بدون arabic_name + ترتيب آمن بـ id
    const selectClients = async (opts: { ids?: string[]; limit?: number } = {}): Promise<ClientLite[]> => {
      const { ids, limit = 50 } = opts;

      // محاولة أولى: عندنا arabic_name
      try {
        let q = supabase.from("client").select("id, name, arabic_name").order("id", { ascending: false });
        if (ids?.length) q = q.in("id", ids);
        else q = q.limit(limit);
        const { data } = await q.throwOnError();
        return ((data as ClientLite[]) ?? []);
      } catch {
        // fallback: بدون arabic_name
        let q2 = supabase.from("client").select("id, name").order("id", { ascending: false });
        if (ids?.length) q2 = q2.in("id", ids);
        else q2 = q2.limit(limit);
        const { data } = await q2.throwOnError();
        return ((data as ClientLite[]) ?? []);
      }
    };

    try {
      // سوبر أدمن → هات كل العملاء واضبط السليكتور على "الكل"
      if (role && ["super_admin", "superadmin", "owner", "admin_super"].includes(role.toLowerCase())) {
        clientList = await selectClients({ limit: 500 });
        setClientId("__ALL__");
        localStorage.removeItem("client_id");
      } else {
        // مستخدم عادي → هات العملاء المرتبطين بيه
        const { data: authRes } = await supabase.auth.getUser();
        const uid = authRes?.user?.id;

        if (uid) {
          const { data: linkRows } = await supabase
            .from("client_users")
            .select("client_id")
            .eq("user_id", uid)
            .throwOnError();

          const clientIds = Array.from(new Set((linkRows || []).map((r: { client_id: string }) => r.client_id)));
          if (clientIds.length) {
            clientList = await selectClients({ ids: clientIds });
          }
        }

        // لو مفيش روابط/نتائج → هات آخر عملاء كـ fallback
        if (clientList.length === 0) {
          clientList = await selectClients({ limit: 50 });
        }

        // اضبط القيمة المختارة
        const lsClient = localStorage.getItem("client_id");
        if (lsClient && clientList.some((c) => c.id === lsClient)) {
          setClientId(lsClient);
        } else if (clientList.length > 0) {
          setClientId(clientList[0].id);
          localStorage.setItem("client_id", clientList[0].id);
        } else {
          setClientId(null);
        }
      }
    } catch (e) {
      console.error("fetchAvailableClients error:", e);
    }

    setAllClients(clientList);
    setIsClientsLoading(false);
  }, []);

  /* ===== Boot: role من JWT ===== */
  type AppMeta = { role?: string; [k: string]: unknown };
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const roleFromJWT = ((data.user?.app_metadata as AppMeta)?.role || "").toLowerCase();
        const superMode = ["super_admin", "superadmin", "owner", "admin_super"].includes(roleFromJWT);
        setIsSuperAdmin(superMode);
        await fetchAvailableClients(roleFromJWT);
      } catch (e) {
        console.error(e);
        await fetchAvailableClients();
      }
    })();
  }, [fetchAvailableClients]);

  /* ===== React to client change ===== */
  useEffect(() => {
    // سوبر أدمن + الكل
    if (isSuperAdmin && (!clientId || clientId === "__ALL__")) {
      resetFilterSelections();
      fetchSchedules("__ALL__", true);
      fetchUsersMap("__ALL__", true);
      // الفلاتر (Regions/Cities/Stores) ملهاش معنى للكل → نفرّغها
      setAllRegions([]);
      setAllCities([]);
      setAllStores([]);
      return;
    }

    if (!clientId) {
      setSchedules([]);
      setAllTeamLeaders([]);
      setAllRegions([]);
      setAllCities([]);
      setAllStores([]);
      setLoading(false);
      return;
    }

    resetFilterSelections();
    localStorage.setItem("client_id", clientId);
    fetchSchedules(clientId, isSuperAdmin);
    fetchUsersMap(clientId, isSuperAdmin);
    fetchFilterOptionsForClient(clientId);
  }, [clientId, isSuperAdmin, fetchSchedules, fetchFilterOptionsForClient, fetchUsersMap]);

  /* ===== Actions ===== */
  const handleToggleActive = async (report: ScheduledReport) => {
    const newState = !report.is_active;
    setSchedules((prev) => prev.map((r) => (r.id === report.id ? { ...r, is_active: newState } : r)));
    const { error } = await supabase.from("scheduled_email_reports").update({ is_active: newState }).eq("id", report.id);
    if (error) {
      setSchedules((prev) => prev.map((r) => (r.id === report.id ? { ...r, is_active: !newState } : r)));
      alert(T.toggledFail(error.message));
    } else {
      alert(T.toggledOk);
    }
  };

  const handleDelete = async (report: ScheduledReport) => {
    const ok = window.confirm(T.confirmDelete);
    if (!ok) return;
    const keep = schedules.filter((r) => r.id !== report.id);
    setSchedules(keep);
    const { error } = await supabase.from("scheduled_email_reports").delete().eq("id", report.id);
    if (error) {
      setSchedules((prev) => [...prev, report].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
      alert(T.deletedFail(error.message));
    } else {
      alert(T.deletedOk);
    }
  };

  /* ===== Save new schedule ===== */
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) {
      alert(isArabic ? "البريد الإلكتروني للمستلم مطلوب." : "Recipient email is required.");
      return;
    }
    if (isSuperAdmin && (!clientId || clientId === "__ALL__")) {
      alert(T.mustPickClient);
      return;
    }

    setIsSaving(true);

    const filtersToSave: Exclude<ReportFilters, null> = {};
    if (selectedRegion) filtersToSave.region = selectedRegion;
    if (selectedCity) filtersToSave.city = selectedCity;
    if (selectedStore) filtersToSave.store = selectedStore;
    if (selectedTL) filtersToSave.team_leader_id = selectedTL;
    if (selectedStatus) filtersToSave.status = selectedStatus;

    const { error } = await supabase.rpc("insert_scheduled_report", {
      p_client_id: clientId,
      p_recipient_email: recipientEmail,
      p_filters: Object.keys(filtersToSave).length > 0 ? filtersToSave : null,
    });

    if (error) {
      alert(T.saveFail(error.message));
    } else {
      alert(T.savedOk);
      setRecipientEmail("");
      resetFilterSelections();
      fetchSchedules(clientId, isSuperAdmin);
    }
    setIsSaving(false);
  };

  // خرائط عرض الاسم بدل UUID
  const clientNameById = useMemo(
  () =>
    new Map(
      allClients.map((c) => [
        c.id,
        (isArabic ? c.arabic_name || c.name : c.name || c.arabic_name) || "-", // ← الاسم العربي أو الإنجليزي
      ])
    ),
  [allClients, isArabic]
);

  const tlDisplay = useCallback(
    (id?: string) => {
      if (!id) return "-";
      const u = usersMap.get(id);
      if (!u) return id; // fallback لو مش موجود
      const displayName = isArabic ? u.arabic_name || u.name : u.name || u.arabic_name;
      return `${displayName ?? id}${u.role ? ` - ${u.role}` : ""}`;
    },
    [usersMap, isArabic]
  );

  /* ========= Render ========= */
  return (
    <main style={{ maxWidth: 1000, margin: "24px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, textAlign: "center", marginBottom: 24 }}>{T.title}</h1>

      {/* Client Selector */}
      <div style={{ background: "var(--card)", border: "1px solid var(--divider)", padding: 16, borderRadius: 8, marginBottom: 24 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>{T.client}</label>
        <select
          value={clientId ?? (isSuperAdmin ? "__ALL__" : "")}
          onChange={(e) => setClientId(e.target.value || null)}
          disabled={isClientsLoading}
          style={{ ...selectStyle, maxWidth: 480 }}
        >
          {isSuperAdmin && <option value="__ALL__">{T.allClients}</option>}
          {!isSuperAdmin && <option value="">{T.pickClient}</option>}
          {allClients.map((c) => (
            <option key={c.id} value={c.id}>
              {isArabic ? c.arabic_name || c.name || c.id : c.name || c.arabic_name || c.id}
            </option>
          ))}
        </select>
      </div>

      {/* Current Schedules */}
      <div style={{ background: "var(--card)", border: "1px solid var(--divider)", padding: 16, borderRadius: 8, marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>{T.currentSchedules}</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {isSuperAdmin && <th style={thStyle}>{isArabic ? "العميل" : "Client"}</th>}
                <th style={thStyle}>{T.recipient}</th>
                <th style={thStyle}>{T.appliedFilters}</th>
                <th style={thStyle}>{T.rowStatus}</th>
                <th style={thStyle}>{T.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 4} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>
                    {T.loading}
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 4} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>
                    {T.noSchedules}
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => {
                  const f = schedule.filters;
                  const niceFilters = !f
                    ? "-"
                    : [
                        f.region ? `${T.region}: ${f.region}` : null,
                        f.city ? `${T.city}: ${f.city}` : null,
                        f.store ? `${T.store}: ${f.store}` : null,
                        f.team_leader_id ? `${T.tl}: ${tlDisplay(f.team_leader_id)}` : null,
                        f.status ? `${T.status}: ${f.status}` : null,
                      ]
                        .filter(Boolean)
                        .join(" | ");

                  return (
                    <tr key={schedule.id} style={{ borderTop: "1px solid var(--divider)" }}>
                      {isSuperAdmin && (
                        <td style={tdStyle}>{clientNameById.get(schedule.client_id ?? "") || schedule.client_id || "-"}</td>
                      )}
                      <td style={tdStyle}>{schedule.recipient_email}</td>
                      <td style={tdStyle}>{niceFilters || "-"}</td>
                      <td style={tdStyle}>
                        {schedule.is_active ? (isArabic ? "نشط" : "Active") : (isArabic ? "متوقف" : "Inactive")}
                      </td>
                      <td style={{ ...tdStyle, display: "flex", gap: 8, justifyContent: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(schedule)}
                          style={{
                            padding: "6px 10px",
                            background: "var(--accent)",
                            color: "var(--accent-foreground)",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {schedule.is_active ? T.deactivate : T.activate}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(schedule)}
                          style={{
                            padding: "6px 10px",
                            background: "transparent",
                            color: "red",
                            border: "1px solid red",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {T.delete}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create New */}
      <div style={{ background: "var(--card)", border: "1px solid var(--divider)", padding: 16, borderRadius: 8 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>{T.addNew}</h2>
        <form onSubmit={handleSaveSchedule} style={{ display: "grid", gap: 16 }}>
          <div>
            <label htmlFor="email" style={{ display: "block", marginBottom: 8 }}>
              {T.recipientEmail}
            </label>
            <input
              id="email"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: 8,
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                color: "var(--text)",
                borderRadius: 4,
              }}
            />
          </div>

          {/* الفلاتر تظهر دائمًا؛ لو الكل ⇒ Disabled + رسالة */}
          <fieldset style={{ border: "1px solid var(--divider)", borderRadius: 4, padding: 16 }}>
            <legend>{T.filters}</legend>
            {isSuperAdmin && (!clientId || clientId === "__ALL__") && (
              <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>{T.filtersDisabled}</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>{T.region}</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  style={selectStyle}
                  disabled={isSuperAdmin && (!clientId || clientId === "__ALL__")}
                >
                  <option value="">{T.all}</option>
                  {allRegions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>{T.city}</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  style={selectStyle}
                  disabled={isSuperAdmin && (!clientId || clientId === "__ALL__")}
                >
                  <option value="">{T.all}</option>
                  {allCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>{T.store}</label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  style={selectStyle}
                  disabled={isSuperAdmin && (!clientId || clientId === "__ALL__")}
                >
                  <option value="">{T.all}</option>
                  {allStores.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>{T.tl}</label>
                <select
                  value={selectedTL}
                  onChange={(e) => setSelectedTL(e.target.value)}
                  style={selectStyle}
                  disabled={isSuperAdmin && (!clientId || clientId === "__ALL__")}
                >
                  <option value="">{T.all}</option>
                  {allTeamLeaders.map((tl) => (
                    <option key={tl.id} value={tl.id}>
                      {(isArabic ? tl.arabic_name || tl.name : tl.name || tl.arabic_name) ?? tl.id}
                      {tl.role ? ` - ${tl.role}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>{T.status}</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  style={selectStyle}
                  disabled={isSuperAdmin && (!clientId || clientId === "__ALL__")}
                >
                  <option value="">{T.all}</option>
                  <option value={isArabic ? "مكتملة" : "Finished"}>{isArabic ? "مكتملة" : "Finished"}</option>
                  <option value={isArabic ? "منتهية" : "Ended"}>{isArabic ? "منتهية" : "Ended"}</option>
                  <option value={isArabic ? "معلقة" : "Pending"}>{isArabic ? "معلقة" : "Pending"}</option>
                </select>
              </div>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={isSaving || (isSuperAdmin && (!clientId || clientId === "__ALL__"))}
            style={{
              padding: "10px 20px",
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              border: "none",
              borderRadius: 4,
              cursor: isSaving ? "not-allowed" : "pointer",
              fontWeight: 700,
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? T.saving : T.save}
          </button>
        </form>
      </div>
      {/* زر الرجوع */}
<div style={{ textAlign: "center", marginTop: 32 }}>
  <button
    type="button"
    onClick={() => (window.location.href = "/super-admin/dashboard")}
    style={{
      padding: "10px 20px",
      background: "transparent",
      border: "1px solid var(--accent)",
      color: "var(--accent)",
      borderRadius: 6,
      cursor: "pointer",
      fontWeight: 700,
      transition: "all 0.2s",
    }}
    onMouseEnter={(e) => ((e.currentTarget.style.background = "var(--accent)"), (e.currentTarget.style.color = "var(--accent-foreground)"))}
    onMouseLeave={(e) => ((e.currentTarget.style.background = "transparent"), (e.currentTarget.style.color = "var(--accent)"))}
  >
    {isArabic ? "← رجوع إلى لوحة التحكم" : "← Back to Dashboard"}
  </button>
</div>

    </main>
  );
}
