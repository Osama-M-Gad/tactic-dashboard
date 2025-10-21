"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";
import { useLangTheme } from "@/hooks/useLangTheme";
import { useUserFilters } from '@/hooks/useUserFilters';
import SupaImg from "@/components/SupaImg";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/* ========= Types ========= */
type UUID = string;
type UserRow = { id: UUID; name: string | null; arabic_name: string | null; role: string | null; team_leader_id: UUID | null; };
type MarketRow = { id: UUID; store: string | null; branch: string | null; region: string | null; city: string | null; };
type InventoryReport = { id: UUID; created_at: string; is_available: boolean | null; quantity: number[] | null; expiry_date: (string | null)[] | null; custom_reason: string | null; photos: string[] | null; user?: { id: UUID; name: string | null; arabic_name: string | null }; market?: { id: string; store: string | null; branch: string | null; region: string | null; city: string | null }; product?: { name: string | null }; reason?: { reason_en: string | null; reason_ar: string | null }; };

/* ========= Small UI helpers ========= */
const cardBorder = "1px solid var(--divider)";
function Panel({ title, children }: { title: string; children: ReactNode }) { return ( <div style={{ border: cardBorder, background: "var(--card)", borderRadius: 16, padding: 12 }}> <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, opacity: 0.9 }}>{title}</h3> {children} </div> ); }
function EmptyBox({ text }: { text: string }) { return ( <div style={{ border: cardBorder, background: "var(--input-bg)", borderRadius: 12, padding: 24, textAlign: "center", fontSize: 13, opacity: 0.85, }} > {text} </div> ); }
function OpenPhotosBadge({ count, onClick, label = "فتح", }: { count: number; onClick: () => void; label?: string; }) { return ( <button onClick={onClick} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 56, height: 44, padding: "6px 10px", borderRadius: 10, border: "1px solid color-mix(in oklab, var(--accent) 50%, transparent)", background: "color-mix(in oklab, var(--accent) 25%, var(--card))", color: "var(--text)", fontWeight: 800, cursor: "pointer", boxShadow: "inset 0 1px 0 color-mix(in oklab, #fff 15%, transparent), 0 0 0 2px color-mix(in oklab, var(--accent) 15%, transparent)", }} > <span style={{ lineHeight: 1 }}>{label}</span> <span style={{ lineHeight: 1, opacity: 0.9 }}>({count})</span> </button> ); }
function btn(h?: number, selected = false): React.CSSProperties { return { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", height: h || 44, padding: "10px 12px", borderRadius: 12, border: selected ? "1px solid var(--accent)" : "1px solid var(--input-border)", background: selected ? "color-mix(in oklab, var(--accent) 10%, var(--input-bg))" : "var(--input-bg)", color: "var(--text)", cursor: "pointer", boxShadow: selected ? "0 0 0 2px color-mix(in oklab, var(--accent) 25%, transparent)" : "none", fontWeight: 700, transition: "all 0.15s ease", }; }
function GoldenSpinner({ size = 72, thickness = 6 }: { size?: number; thickness?: number }) { const accent = "var(--accent, #F5A623)"; const bg = "color-mix(in oklab, var(--card) 40%, transparent)"; return ( <> <div role="status" aria-label="loading" style={{ width: size, height: size, borderRadius: "50%", border: `${thickness}px solid ${bg}`, borderTopColor: accent, animation: "spin 0.9s linear infinite", boxShadow: `0 0 0 2px color-mix(in oklab, ${accent} 20%, transparent), inset 0 0 12px color-mix(in oklab, ${accent} 15%, transparent)`, }} /> <style jsx>{` @keyframes spin { to { transform: rotate(360deg); } } `}</style> </> ); }

/* ========= Page ========= */
export default function InventoryReportPage() {
  const { isArabic: ar } = useLangTheme();
  const { filters: userFilters, loading: filtersLoading } = useUserFilters();

  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [allClientUsers, setAllClientUsers] = useState<UserRow[]>([]);
  const [allClientMarkets, setAllClientMarkets] = useState<MarketRow[]>([]);
  const [reports, setReports] = useState<InventoryReport[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [selectedTL, setSelectedTL] = useState<UUID | "ALL">("ALL");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState(""); // ✅ إضافة حالة للمدينة
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<UUID[]>([]);
  const [selectedMarketStore, setSelectedMarketStore] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<UUID | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<InventoryReport[]>([]);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [imgLoading, setImgLoading] = useState(false);

  const openGallery = (arr: string[]) => { if (!arr || arr.length === 0) return; setLightboxImages(arr); setLightboxIndex(0); setImgLoading(true); };

  useEffect(() => { if (typeof window !== "undefined") { const cid = localStorage.getItem("client_id"); setClientId(cid); } }, []);
  useEffect(() => { if (lightboxImages) { const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; } }, [lightboxImages]);

  // ✅ 1. تطبيق الفلاتر الإجبارية (المنطقة، المدينة، قائد الفريق، السوق)
  useEffect(() => {
    if (!filtersLoading && userFilters) {
      if (userFilters.default_region?.[0]) {
        setSelectedRegion(userFilters.default_region[0]);
      }
      if (userFilters.default_city?.[0]) { // ✅ قراءة default_city
        setSelectedCity(userFilters.default_city[0]);
      }
      if (userFilters.allowed_markets?.[0]) { // ✅ قراءة allowed_markets وتطبيقه على السوق
          setSelectedStore(userFilters.allowed_markets[0]);
      }
      if (userFilters.Team_leader?.[0]) {
        setSelectedTL(userFilters.Team_leader[0]);
      }
    }
  }, [userFilters, filtersLoading]);

  /* Initial data: users & markets for that client */
  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    (async () => {
      try {
        setLoading(true);
        const { data: usersData } = await supabase.from("client_users").select("Users:Users!inner(id,name,arabic_name,role,team_leader_id)").eq("client_id", clientId).eq("is_active", true).order("user_id", { ascending: true }).returns<{ Users: UserRow | null }[]>();
        setAllClientUsers((usersData ?? []).map((r) => r.Users).filter((u): u is UserRow => Boolean(u)));
        const { data: marketsData } = await supabase.from("client_markets").select("Markets:Markets!inner(id,store,branch,region,city)").eq("client_id", clientId).order("market_id", { ascending: true }).returns<{ Markets: MarketRow | null }[]>();
        setAllClientMarkets((marketsData ?? []).map((r) => r.Markets).filter((m): m is MarketRow => Boolean(m)));
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  /* Load all reports for that client */
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from("InventoryReports").select(`*, user:Users(*), product:Products(*), reason:reasons(reason_en,reason_ar), market:Markets(*)`).eq("client_id", clientId);
        if (!error) setReports((data ?? []) as InventoryReport[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  // ✅ 2. تعديل دالة الريست لتحترم الفلاتر الإجبارية الجديدة
  const resetFilters = () => {
    setDateFrom(null);
    setDateTo(null);
    if (!userFilters?.Team_leader?.[0]) setSelectedTL("ALL");
    if (!userFilters?.default_region?.[0]) setSelectedRegion("");
    if (!userFilters?.default_city?.[0]) setSelectedCity(""); // ✅ إضافة المدينة
    if (!userFilters?.allowed_markets?.[0]) setSelectedStore(""); // ✅ إضافة السوق
    setSelectedUsers([]);
    setSelectedMarketStore(null);
    setSelectedBranchId(null);
  };
  
  const handleDateFromChange = (date: Date | null) => { setDateFrom(date); if (dateTo && date && date > dateTo) { setDateTo(null); } };

  /* Derived options */
  // ✅ 3. فلترة خيارات المدن المتاحة
  const citiesOptions = useMemo(() => {
      let marketsToConsider = allClientMarkets;
      if (selectedRegion) {
        marketsToConsider = marketsToConsider.filter(m => m.region === selectedRegion);
      }

      if (userFilters?.default_city?.length) { // ✅ إذا كانت المدينة إجبارية
        return userFilters.default_city;
      }
      
      const s = new Set<string>();
      for (const m of marketsToConsider) if (m.city) s.add(m.city);
      return Array.from(s).sort((a, b) => a.localeCompare(b, "ar"));
  }, [allClientMarkets, selectedRegion, userFilters]);

  const teamLeaders = useMemo(() => {
    const baseTLs = allClientUsers.filter((u) => (u.role ?? "").toLowerCase().replace(/_/g, " ").includes("team leader"));
    if (userFilters?.Team_leader?.length) {
      const allowedTLs = new Set(userFilters.Team_leader);
      return baseTLs.filter(tl => allowedTLs.has(tl.id));
    }
    return baseTLs;
  }, [allClientUsers, userFilters]);

  const regionOptions = useMemo(() => {
    if (userFilters?.default_region?.length) {
      return userFilters.default_region;
    }
    const s = new Set<string>();
    for (const m of allClientMarkets) if (m.region) s.add(m.region);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ar"));
  }, [allClientMarkets, userFilters]);

  const storeOptions = useMemo(() => {
    let marketsToConsider = allClientMarkets;
    
    // فلترة أولية حسب المنطقة والمدينة المختارة
    if (selectedRegion) marketsToConsider = marketsToConsider.filter(m => m.region === selectedRegion);
    if (selectedCity) marketsToConsider = marketsToConsider.filter(m => m.city === selectedCity);
    
    // فلترة حسب صلاحيات المستخدم (allowed_markets)
    if (userFilters?.allowed_markets?.length) {
        const allowedMarketsSet = new Set(userFilters.allowed_markets);
        marketsToConsider = marketsToConsider.filter(m => m.store && allowedMarketsSet.has(m.store));
    }
    const s = new Set<string>();
    for (const m of marketsToConsider) if (m.store) s.add(m.store);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ar"));
  }, [allClientMarkets, userFilters, selectedRegion, selectedCity]);

  /* Top filters for the grid table */
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const reportDate = new Date(r.created_at);
      const fromOk = !dateFrom || reportDate >= dateFrom;
      let toOk = true;
      if (dateTo) {
        const toDateEnd = new Date(dateTo);
        toDateEnd.setHours(23, 59, 59, 999);
        toOk = reportDate <= toDateEnd;
      }
      // ✅ إضافة فلترة المدينة
      const regionOk = !selectedRegion || r.market?.region === selectedRegion;
      const cityOk = !selectedCity || r.market?.city === selectedCity;
      const storeOk = !selectedStore || r.market?.store === selectedStore;
      return fromOk && toOk && regionOk && cityOk && storeOk;
    });
  }, [reports, dateFrom, dateTo, selectedRegion, selectedCity, selectedStore]);

  const usersForPanel = useMemo(() => { const mchUsers = allClientUsers.filter((u) => (u.role ?? "").toLowerCase() === "mch"); if (selectedTL === "ALL") return mchUsers; return mchUsers.filter((u) => u.team_leader_id === selectedTL); }, [allClientUsers, selectedTL]);
  const reportsFilteredByUsers = useMemo(() => filteredReports.filter((r) => selectedUsers.includes(r.user?.id || "")), [filteredReports, selectedUsers]); 
  const marketsForPanel = useMemo(() => { if (selectedUsers.length === 0) return []; const marketStores = new Set<string>(); for (const r of reportsFilteredByUsers) if (r.market?.store) marketStores.add(r.market.store); return Array.from(marketStores).sort(); }, [reportsFilteredByUsers, selectedUsers.length]);
  const branchesForPanel = useMemo(() => { if (!selectedMarketStore) return []; const branches = new Map<UUID, string>(); for (const r of reportsFilteredByUsers) { if (r.market?.store === selectedMarketStore && r.market.id && r.market.branch) { branches.set(r.market.id, r.market.branch); } } return Array.from(branches.entries()).map(([id, branch]) => ({ id, branch: branch || "" })); }, [reportsFilteredByUsers, selectedMarketStore]);
  const datesForPanel = useMemo(() => { if (!selectedBranchId) return []; const dates = new Set<string>(); for (const r of reportsFilteredByUsers) { if (r.market?.id === selectedBranchId) dates.add(new Date(r.created_at).toISOString().split("T")[0]); } return Array.from(dates).sort((a, b) => b.localeCompare(a)); }, [reportsFilteredByUsers, selectedBranchId]);

  const openModalWithData = (date: string, branchId: UUID) => { const dataForModal = filteredReports.filter((r) => r.market?.id === branchId && new Date(r.created_at).toISOString().split("T")[0] === date); setModalData(dataForModal); setModalOpen(true); };
  const T = useMemo(() => ({ back: ar ? "رجوع" : "Back", pageTitle: ar ? "تقارير الجرد" : "Inventory Reports" }), [ar]);

  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setModalOpen(false); setLightboxImages(null); setLightboxIndex(0); } if (lightboxImages && lightboxImages.length > 1) { if (e.key === "ArrowRight") setLightboxIndex((i) => (i + 1) % lightboxImages.length); else if (e.key === "ArrowLeft") setLightboxIndex((i) => (i - 1 + lightboxImages.length) % lightboxImages.length); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [lightboxImages]);

  if (loading || filtersLoading) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <GoldenSpinner />
          <div style={{ color: "var(--text)", fontWeight: 700, letterSpacing: 0.3 }}>
            {ar ? "جاري تحميل البيانات..." : "Loading Data..."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 16 }}>
      <style jsx global>{`
        .react-datepicker-wrapper input { width: 100%; height: 46px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--input-border); background: var(--card); color: var(--text); font-weight: 700; }
        .react-datepicker-wrapper input::placeholder { color: var(--muted); font-weight: 500; }
        .react-datepicker__header { background-color: var(--card) !important; }
        .react-datepicker__month-container { background-color: var(--card); border: 1px solid var(--divider); }
        .react-datepicker__current-month, .react-datepicker-time__header, .react-datepicker-year-header, .react-datepicker__day-name, .react-datepicker__day, .react-datepicker__time-name { color: var(--text) !important; }
        .react-datepicker__day--disabled { opacity: 0.3; }
      `}</style>
      
      <h1 style={{ textAlign: "center", marginBottom: 16, fontSize: "2.25em", color: "var(--accent)" }}>{T.pageTitle}</h1>

      <div className="date-picker-container" style={{ position: "sticky", top: 8, zIndex: 20, marginBottom: 16, padding: 10, borderRadius: 16, border: cardBorder, background: "color-mix(in oklab, var(--card) 82%, transparent)", backdropFilter: "blur(8px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>{ar ? "من تاريخ" : "From"}</label>
            <DatePicker selected={dateFrom} onChange={handleDateFromChange} selectsStart startDate={dateFrom} endDate={dateTo} dateFormat="yyyy-MM-dd" placeholderText={ar ? "اختر تاريخ البداية" : "Select start date"} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>{ar ? "إلى تاريخ" : "To"}</label>
            <DatePicker selected={dateTo} onChange={(date) => setDateTo(date)} selectsEnd startDate={dateFrom} endDate={dateTo} minDate={dateFrom || undefined} dateFormat="yyyy-MM-dd" placeholderText={ar ? "اختر تاريخ النهاية" : "Select end date"} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>{ar ? "قائد الفريق" : "Team Leader"}</label>
            <select onChange={(e) => setSelectedTL(e.target.value as UUID | "ALL")} value={selectedTL || ""} style={{ width: "100%", height: 46, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--card)", color: "var(--text)" }} disabled={!!userFilters?.Team_leader?.[0]}>
              {!userFilters?.Team_leader?.[0] && <option value="ALL">{ar ? "كل الفرق" : "All Teams"}</option>}
              {teamLeaders.map((tl) => (<option key={tl.id} value={tl.id}>{ar ? tl.arabic_name || tl.name : tl.name || tl.arabic_name}</option>))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>{ar ? "المنطقة" : "Region"}</label>
            <select onChange={(e) => setSelectedRegion(e.target.value)} value={selectedRegion} style={{ width: "100%", height: 46, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--card)", color: "var(--text)" }} disabled={!!userFilters?.default_region?.[0]}>
              {!userFilters?.default_region?.[0] && <option value="">{ar ? "الكل" : "All"}</option>}
              {regionOptions.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>{ar ? "المدينة" : "City"}</label>
            <select onChange={(e) => setSelectedCity(e.target.value)} value={selectedCity} style={{ width: "100%", height: 46, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--card)", color: "var(--text)" }} disabled={!!userFilters?.default_city?.[0]}>
              {!userFilters?.default_city?.[0] && <option value="">{ar ? "الكل" : "All"}</option>}
              {citiesOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>{ar ? "السوق" : "Store"}</label>
            <select onChange={(e) => setSelectedStore(e.target.value)} value={selectedStore} style={{ width: "100%", height: 46, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--input-border)", background: "var(--card)", color: "var(--text)" }} disabled={!!userFilters?.allowed_markets?.length && userFilters.allowed_markets.length === 1}>
              {!userFilters?.allowed_markets?.length || userFilters.allowed_markets.length > 1 ? (<option value="">{ar ? "الكل" : "All"}</option>) : null}
              {storeOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <button onClick={resetFilters} style={{ height: 46, fontWeight: 700, border: "1px solid var(--divider)", borderRadius: 12, background: "var(--card)", color: "var(--text)", cursor: "pointer" }}>{ar ? "إعادة تعيين" : "Reset"}</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel title={ar ? "المنسقون (MCH)" : "Coordinators (MCH)"}>
          {usersForPanel.length === 0 ? (<EmptyBox text={ar ? "اختر قائد فريق أو لا يوجد منسقون" : "Select a team leader or no coordinators found"} />) : (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              <button onClick={() => { const allIds = usersForPanel.map((u) => u.id); setSelectedUsers(allIds.every((id) => selectedUsers.includes(id)) ? [] : allIds); }} style={btn(undefined, usersForPanel.length > 0 && selectedUsers.length === usersForPanel.length)} > {ar ? "تحديد الكل" : "Select All"} </button>
              {usersForPanel.map((user) => {
                const isSelected = selectedUsers.includes(user.id);
                return ( <button key={user.id} onClick={() => setSelectedUsers((p) => (isSelected ? p.filter((id) => id !== user.id) : [...p, user.id]))} style={btn(48, isSelected)} > <span>{ar ? user.arabic_name || user.name : user.name || user.arabic_name}</span> <span style={{ opacity: 0.6 }}>{isSelected ? "✓" : "＋"}</span> </button> );
              })}
            </div>
          )}
        </Panel>

        {selectedUsers.length > 0 && (
          <Panel title={ar ? "الأسواق (Stores)" : "Stores"}>
            {marketsForPanel.length === 0 ? (<EmptyBox text={ar ? "لا توجد أسواق لهؤلاء المستخدمين" : "No stores for these users"} />) : (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {marketsForPanel.map((store) => (<button key={store} onClick={() => { setSelectedMarketStore(store); setSelectedBranchId(null); }} style={btn(48, selectedMarketStore === store)} > <span>{store}</span> <span style={{ opacity: 0.6 }}>{selectedMarketStore === store ? "✓" : "＋"}</span> </button>))}
              </div>
            )}
          </Panel>
        )}

        {selectedMarketStore && (
          <Panel title={ar ? "الفروع" : "Branches"}>
            {branchesForPanel.length === 0 ? (<EmptyBox text={ar ? "لا توجد فروع" : "No branches"} />) : (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                {branchesForPanel.map((b) => (<button key={b.id} onClick={() => setSelectedBranchId(b.id)} style={btn(48, selectedBranchId === b.id)}> <span>{b.branch}</span> <span style={{ opacity: 0.6 }}>{selectedBranchId === b.id ? "✓" : "＋"}</span> </button>))}
              </div>
            )}
          </Panel>
        )}

        {selectedBranchId && (
          <Panel title={ar ? "تواريخ الجرد" : "Inventory Dates"}>
            {datesForPanel.length === 0 ? (<EmptyBox text={ar ? "لا توجد زيارات جرد مسجلة" : "No inventory visits recorded"} />) : (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                {datesForPanel.map((date) => (
                  <button key={date} onClick={() => openModalWithData(date, selectedBranchId)} style={btn(48, false)}>
                    <span>{new Date(date + "T00:00:00").toLocaleDateString(ar ? "ar-EG" : "en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        )}

        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
          <Link href="/admin/reports" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, border: "1px solid var(--divider)", background: "var(--card)", color: "var(--text)", textDecoration: "none", fontWeight: 800 }}>{T.back}</Link>
        </div>
      </div>

      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", border: "1px solid var(--divider)", borderRadius: 16, padding: 24, width: "90%", maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>{ar ? "تفاصيل الجرد" : "Inventory Details"}</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text)", fontSize: 24, cursor: "pointer" }}>&times;</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--divider)" }}>
                  <th style={{ padding: "8px", textAlign: ar ? "right" : "left" }}>{ar ? "المنتج" : "Product"}</th>
                  <th style={{ padding: "8px", textAlign: "center" }}>{ar ? "الحالة" : "Status"}</th>
                  <th style={{ padding: "8px", textAlign: ar ? "right" : "left" }}>{ar ? "الملاحظات / السبب" : "Notes / Reason"}</th>
                  <th style={{ padding: "8px", textAlign: "center" }}>{ar ? "الصور" : "Photos"}</th>
                </tr>
              </thead>
              <tbody>
                {modalData.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid var(--divider)" }}>
                    <td style={{ padding: "8px" }}>{item.product?.name || "-"}</td>
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      {item.is_available ? (
                        <div style={{ color: "#22c55e" }}>
                          <strong>{ar ? "متوفر" : "Available"}</strong>
                          {item.quantity && item.expiry_date && item.quantity.length > 0 ? (
                            item.quantity.map((qty, index) => (
                              <div key={index} style={{ fontSize: "0.9em", opacity: 0.9, marginTop: 4, direction: "ltr" }}>
                                {qty} → {item.expiry_date?.[index] ? new Date(item.expiry_date[index]!).toLocaleDateString("en-CA") : ar ? "لا يوجد تاريخ" : "No Date"}
                              </div>
                            ))
                          ) : (<div style={{ fontSize: "0.9em", opacity: 0.9, marginTop: 4 }}>{ar ? "(لا توجد كميات مسجلة)" : "(No quantities recorded)"}</div>)}
                        </div>
                      ) : (<span style={{ color: "#ef4444" }}>{ar ? "غير متوفر" : "Unavailable"}</span>)}
                    </td>
                    <td style={{ padding: "8px" }}>{(ar ? item.reason?.reason_ar : item.reason?.reason_en) || item.custom_reason || "-"}</td>
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      {item.photos && item.photos.length > 0 ? (<OpenPhotosBadge count={item.photos.length} label={ar ? "فتح" : "Open"} onClick={() => openGallery(item.photos!)} />) : ("-")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lightboxImages && (
        <div onClick={() => setLightboxImages(null)} style={{ position: "fixed", inset: 0, zIndex: 101, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
         {imgLoading && (<div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><GoldenSpinner /></div>)}
         <SupaImg key={lightboxImages[lightboxIndex]} src={lightboxImages[lightboxIndex]} alt="Inventory" onLoad={() => setImgLoading(false)} onError={() => setImgLoading(false)} priority style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain", opacity: imgLoading ? 0 : 1, transition: "opacity .2s ease" }} />
          <img key={"preload-" + lightboxImages[lightboxIndex]} src={lightboxImages[lightboxIndex]} alt="" loading="eager" decoding="async" onLoad={() => setImgLoading(false)} onError={() => setImgLoading(false)} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
          <button onClick={(e) => { e.stopPropagation(); setLightboxImages(null); setLightboxIndex(0); }} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "1px solid rgba(255,255,255,0.4)", color: "white", fontSize: 26, cursor: "pointer", borderRadius: 8, width: 44, height: 44, lineHeight: "42px" }} aria-label="Close">&times;</button>
          {lightboxImages.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setImgLoading(true); setLightboxIndex((i) => (i - 1 + lightboxImages.length) % lightboxImages.length); }} style={{ position: "absolute", left: 16, background: "none", border: "1px solid rgba(255,255,255,0.4)", color: "white", fontSize: 22, cursor: "pointer", borderRadius: 8, width: 44, height: 44 }} aria-label="Prev">‹</button>
              <button onClick={(e) => { e.stopPropagation(); setImgLoading(true); setLightboxIndex((i) => (i + 1) % lightboxImages.length); }} style={{ position: "absolute", right: 16, background: "none", border: "1px solid rgba(255,255,255,0.4)", color: "white", fontSize: 22, cursor: "pointer", borderRadius: 8, width: 44, height: 44 }} aria-label="Next">›</button>
              <div style={{ position: "absolute", bottom: 16, right: 16, background: "rgba(0,0,0,0.5)", color: "white", padding: "6px 10px", borderRadius: 10, fontWeight: 700 }}>{lightboxIndex + 1} / {lightboxImages.length}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
