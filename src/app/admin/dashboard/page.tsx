"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { CircularProgressbar, CircularProgressbarWithChildren, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useLangTheme } from "@/hooks/useLangTheme";
import { useUserFilters } from '@/hooks/useUserFilters';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ========= Supabase client =========
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnon);

// ========= Types =========
type Role = "admin" | "super_admin" | string;
type StoredUser = { id: string; username?: string; role?: Role; email?: string; auth_user_id?: string; };
type ClientRow = { id: string; name: string | null; name_ar?: string | null; logo_url?: string | null; };
type TLUser = { id: string; username: string; arabic_name?: string | null };
type MarketRow = { id: string; region?: string | null; city?: string | null; store?: string | null };

// ========= Helpers (outside component) =========
const LS_KEYS = { currentUser: "currentUser", lang: "lang", clientId: "client_id" } as const;

function parseStoredUser(json: string | null): StoredUser | null {
    if (!json) return null;
    try { return JSON.parse(json) as StoredUser; } catch { return null; }
}

function getStoredUser(): StoredUser | null {
    if (typeof window === "undefined") return null;
    try {
        const ls = localStorage.getItem(LS_KEYS.currentUser);
        if (ls) return parseStoredUser(ls);
        const ss = sessionStorage.getItem(LS_KEYS.currentUser);
        if (ss) return parseStoredUser(ss);
    } catch {}
    return null;
}

function toAvatarPublicUrl(raw?: string | null) {
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (!supabaseUrl) return "";
    return `${supabaseUrl}/storage/v1/object/public/avatars/${raw}`;
}

const ORDER_TOP = Object.freeze(["Total Visits", "Completed Visits", "False Visits", "Completed %", "False %"] as const);
const ORDER_BOTTOM = Object.freeze(["Total Items", "Total Available", "Not Available", "Avg Visit Time", "Total Travel Time"] as const);

type FilterValue = string | number | boolean | null;
type Filters = Record<string, FilterValue>;

async function fetchAllRows<T extends Record<string, unknown>>(table: string, filters: Filters, selectExp: string = "*"): Promise<T[]> {
    const pageSize = 1000;
    let from = 0;
    let to = pageSize - 1;
    const out: T[] = [];
    while (true) {
        let q = supabase.from(table).select(selectExp);
        for (const k in filters) { q = q.eq(k, filters[k]); }
        const { data, error } = await q.range(from, to);
        if (error) { console.error(`[fetchAllRows] ${table}:`, error); break; }
        const rows = (data ?? []) as unknown as T[];
        if (rows.length === 0) break;
        out.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize; to += pageSize;
    }
    return out;
}

function fmtHHMM(totalSeconds: number) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function ksaDate(d = new Date()) {
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

// ========= الصفحة =========
export default function AdminDashboardPage() {
    const router = useRouter();
    const { isArabic: isAr } = useLangTheme();
    const { filters: userFilters, loading: filtersLoading } = useUserFilters();

    const [clientId, setClientId] = useState<string | null>(null);
    const [booting, setBooting] = useState(true);
    const [user, setUser] = useState<StoredUser | null>(null);
    const [logoModalOpen, setLogoModalOpen] = useState(false);
    const [totalProducts, setTotalProducts] = useState<number>(0);
    const [totalAvailable, setTotalAvailable] = useState<number>(0);
    const [totalUnavailable, setTotalUnavailable] = useState<number>(0);
    const [totalVisits, setTotalVisits] = useState(0);
    const [finishedVisits, setFinishedVisits] = useState(0);
    const [unfinishedVisits, setUnfinishedVisits] = useState(0);
    const [finishedPct, setFinishedPct] = useState(0);
    const [unfinishedPct, setUnfinishedPct] = useState(0);
    const [dateFrom, setDateFrom] = useState<Date | null>(null);
    const [dateTo, setDateTo] = useState<Date | null>(null);
    const [allMarkets, setAllMarkets] = useState<MarketRow[]>([]);
    const [teamLeaders, setTeamLeaders] = useState<TLUser[]>([]);
    const [selectedRegion, setSelectedRegion] = useState<string>("");
    const [selectedCity, setSelectedCity] = useState<string>("");
    const [selectedMarketName, setSelectedMarketName] = useState<string>("");
    const [selectedTeamLeader, setSelectedTeamLeader] = useState<string>("");
    const [presenceSeconds, setPresenceSeconds] = useState<number>(0);
    const [visitSeconds, setVisitSeconds] = useState<number>(0);
    const [transitSeconds, setTransitSeconds] = useState<number>(0);
    const [client, setClient] = useState<ClientRow | null>(null);
    const [headerInfo, setHeaderInfo] = useState<{ user_name_en?: string; user_name_ar?: string; client_name_en?: string; client_name_ar?: string; client_logo_filename?: string; } | null>(null);
    const [loadingFilters, setLoadingFilters] = useState(false);
    const [tlMarketMap, setTlMarketMap] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (!filtersLoading && userFilters) {
            if (userFilters.default_region?.[0]) setSelectedRegion(userFilters.default_region[0]);
            if (userFilters.default_city?.[0]) setSelectedCity(userFilters.default_city[0]);
            if (userFilters.allowed_markets?.[0] && userFilters.allowed_markets.length === 1) setSelectedMarketName(userFilters.allowed_markets[0]);
            if (userFilters.Team_leader?.[0]) setSelectedTeamLeader(userFilters.Team_leader[0]);
        }
    }, [userFilters, filtersLoading]);

    const resetFilters = () => {
        setDateFrom(null);
        setDateTo(null);
        if (!userFilters?.default_region?.[0]) setSelectedRegion("");
        if (!userFilters?.default_city?.[0]) setSelectedCity("");
        if (!userFilters?.allowed_markets?.[0] || userFilters.allowed_markets.length !== 1) setSelectedMarketName("");
        if (!userFilters?.Team_leader?.[0]) setSelectedTeamLeader("");
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const stored = getStoredUser();
                if (!stored?.id) { router.replace("/login"); return; }
                const { data, error } = await supabase.auth.getSession();
                if (!data?.session || error) {
                    try { localStorage.removeItem(LS_KEYS.currentUser); sessionStorage.removeItem(LS_KEYS.currentUser); } catch {}
                    router.replace("/login"); return;
                }
                const role = String(stored.role || "").toLowerCase();
                if (role !== "admin" && role !== "super_admin") { router.replace("/no-access"); return; }
                if (!cancelled) setUser(stored);
            } finally {
                if (!cancelled) setBooting(false);
            }
        })();
        return () => { cancelled = true; };
    }, [router]);

    const fetchAvailabilityStats = useCallback(async () => {
        if (!clientId) return;
        const from_date_str = dateFrom ? ksaDate(dateFrom) : "1970-01-01";
        const to_date_str = dateTo ? ksaDate(dateTo) : "2999-12-31";
        const { data, error } = await supabase.rpc("get_availability_totals", { p_client_id: clientId, p_from_date: from_date_str, p_to_date: to_date_str, p_region: selectedRegion || null, p_city: selectedCity || null, p_store: (selectedMarketName || "").trim() || null, p_team_leader_id: selectedTeamLeader || null });
        if (error) { console.error("[availability totals] RPC error:", error); setTotalProducts(0); setTotalAvailable(0); setTotalUnavailable(0); return; }
        const row = (data?.[0]) || {};
        setTotalProducts(Number(row.total_items || 0));
        setTotalAvailable(Number(row.total_available || 0));
        setTotalUnavailable(Number(row.total_unavailable || 0));
    }, [clientId, dateFrom, dateTo, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader]);

    const fetchVisitCards = useCallback(async () => {
        if (!clientId) return;
        const from_date_str = dateFrom ? ksaDate(dateFrom) : "1970-01-01";
        const to_date_str = dateTo ? ksaDate(dateTo) : "2999-12-31";
        const { data, error } = await supabase.rpc("get_visit_cards_totals", { p_client_id: clientId, p_from_date: from_date_str, p_to_date: to_date_str, p_region: selectedRegion || null, p_city: selectedCity || null, p_store: (selectedMarketName || "").trim() || null, p_team_leader_id: selectedTeamLeader || null });
        if (error) { console.error("[visit cards] RPC error:", error); setTotalVisits(0); setFinishedVisits(0); setUnfinishedVisits(0); setFinishedPct(0); setUnfinishedPct(0); return; }
        const row = data?.[0] || {};
        setTotalVisits(Number(row.total_visits || 0));
        setFinishedVisits(Number(row.finished_visits || 0));
        setUnfinishedVisits(Number(row.unfinished_visits || 0));
        setFinishedPct(Number(row.finished_pct || 0));
        setUnfinishedPct(Number(row.unfinished_pct || 0));
    }, [clientId, dateFrom, dateTo, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader]);
    
    const fetchTeamLeaderMarketLinks = useCallback(async () => {
        if (!clientId) return;
        const { data: visitsData, error: visitsError } = await supabase.from("Visits").select("user_id, market_id").eq("client_id", clientId);
        if (visitsError || !visitsData) { console.error("Error fetching visit links:", visitsError); return; }
        const { data: usersData, error: usersError } = await supabase.from("Users").select("id, team_leader_id").not("team_leader_id", "is", null);
        if (usersError || !usersData) { console.error("Error fetching user-tl links:", usersError); return; }
        const userToTlMap: Record<string, string> = {};
        for (const user of usersData) { if (user.id && user.team_leader_id) userToTlMap[user.id] = user.team_leader_id; }
        const map: Record<string, Set<string>> = {};
        for (const visit of visitsData) {
            if (visit.user_id && visit.market_id) {
                const tlId = userToTlMap[visit.user_id];
                if (tlId) {
                    if (!map[tlId]) map[tlId] = new Set();
                    map[tlId].add(visit.market_id);
                }
            }
        }
        const finalMap: Record<string, string[]> = {};
        for (const tlId in map) { finalMap[tlId] = Array.from(map[tlId]); }
        setTlMarketMap(finalMap);
    }, [clientId]);

    const fetchClientTeamLeaders = useCallback(async () => {
        if (!clientId) return;
        setLoadingFilters(true);
        const { data: cuList } = await supabase.from("client_users").select("user_id").eq("client_id", clientId).eq("is_active", true);
        const userIds = (cuList || []).map(r => r.user_id).filter(Boolean);
        if (userIds.length === 0) { setTeamLeaders([]); setLoadingFilters(false); return; }
        const { data: uData } = await supabase.from("Users").select("id,username,arabic_name,role").in("id", userIds).in("role", ["Team Leader", "team_leader", "TEAM_LEADER", "Team_Leader"]);
        const tls = (uData || []).map(u => ({ id: String(u.id), username: String(u.username || ""), arabic_name: u.arabic_name })).filter(u => !!u.username);
        setTeamLeaders(tls);
        setLoadingFilters(false);
    }, [clientId]);

    const fetchClientMarkets = useCallback(async () => {
        if (!clientId) { setAllMarkets([]); return; }
        setLoadingFilters(true);
        const allVisits = await fetchAllRows<{ market_id: string | null }>("Visits", { client_id: clientId }, "market_id");
        const ids = Array.from(new Set(allVisits.map(v => v.market_id).filter((x): x is string => !!x)));
        if (ids.length === 0) { setAllMarkets([]); setLoadingFilters(false); return; }
        const { data, error } = await supabase.from("Markets").select("id, region, city, store").in("id", ids);
        if (error || !data) { console.error("Markets error", error); setAllMarkets([]); setLoadingFilters(false); return; }
        setAllMarkets(data as MarketRow[]);
        setLoadingFilters(false);
    }, [clientId]);

    const fetchPresenceVisitTransit = useCallback(async () => {
        if (!clientId) { setPresenceSeconds(0); setVisitSeconds(0); setTransitSeconds(0); return; }
        const from_date_str = dateFrom ? ksaDate(dateFrom) : "1970-01-01";
        const to_date_str = dateTo ? ksaDate(dateTo) : "2999-12-31";
        let pres = 0;
        {
            let q = supabase.from("v_presence_visit_unified").select("presence_for_sum", { count: "exact", head: false }).eq("client_id", clientId).gte("snapshot_date", from_date_str).lte("snapshot_date", to_date_str);
            if (selectedRegion) q = q.eq("region", selectedRegion);
            if (selectedCity) q = q.eq("city", selectedCity);
            if (selectedMarketName) q = q.eq("store", selectedMarketName);
            if (selectedTeamLeader) q = q.eq("team_leader_id", selectedTeamLeader);
            const pageSize = 1000; let from = 0, to = pageSize - 1;
            while (true) {
                const { data, error } = await q.range(from, to);
                if (error) { console.error("presence fetch error", error); break; }
                const rows = (data ?? []);
                for (const r of rows) if (typeof r.presence_for_sum === "number") pres += r.presence_for_sum;
                if (!rows.length || rows.length < pageSize) break;
                from += pageSize; to += pageSize;
            }
        }
        let visit = 0;
        const marketsById: Record<string, MarketRow> = {};
        const needMarketFilter = !!(selectedRegion || selectedCity || selectedMarketName);
        if (needMarketFilter) {
            const vIds = await fetchAllRows<{ market_id: string | null }>("Visits", { client_id: clientId }, "market_id");
            const ids = Array.from(new Set(vIds.map(v => v.market_id).filter((x): x is string => !!x)));
            if (ids.length) {
                const { data: mData } = await supabase.from("Markets").select("id, region, city, store").in("id", ids);
                for (const m of (mData ?? [])) { marketsById[String(m.id)] = m as MarketRow; }
            }
        }
        const userTL: Record<string, string|null> = {};
        if (selectedTeamLeader) {
            const { data: uData } = await supabase.from("Users").select("id, team_leader_id").not("team_leader_id", "is", null);
            for (const u of (uData ?? [])) { userTL[String(u.id)] = u.team_leader_id ? String(u.team_leader_id) : null; }
        }
        {
            const q = supabase.from("DailyVisitSnapshots").select("user_id, market_id, started_at, finished_at", { count: "exact", head: false }).eq("client_id", clientId).gte("snapshot_date", from_date_str).lte("snapshot_date", to_date_str).not("started_at", "is", null).not("finished_at", "is", null);
            const pageSize = 1000; let from = 0, to = pageSize - 1;
            while (true) {
                const { data, error } = await q.range(from, to);
                if (error) { console.error("snapshots fetch error", error); break; }
                const rows = (data ?? []);
                for (const r of rows) {
                    if (selectedTeamLeader) {
                        const tl = userTL[String(r.user_id)] || null;
                        if (tl !== selectedTeamLeader) continue;
                    }
                    if (needMarketFilter) {
                        const m = r.market_id ? marketsById[String(r.market_id)] : undefined;
                        if (!m) continue;
                        if (selectedRegion && m.region !== selectedRegion) continue;
                        if (selectedCity && m.city !== selectedCity) continue;
                        if (selectedMarketName && m.store !== selectedMarketName) continue;
                    }
                    const start = new Date(r.started_at).getTime();
                    const end  = new Date(r.finished_at).getTime();
                    const diff  = Math.max(0, Math.floor((end - start) / 1000));
                    visit += diff;
                }
                if (!rows.length || rows.length < pageSize) break;
                from += pageSize; to += pageSize;
            }
        }
        const transit = Math.max(0, pres - visit);
        setPresenceSeconds(pres);
        setVisitSeconds(visit);
        setTransitSeconds(transit);
    }, [clientId, dateFrom, dateTo, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader]);

    const resolveClientAndDetails = useCallback(async () => {
        const { data: session } = await supabase.auth.getSession();
        const authUid = session?.session?.user?.id;
        if (!authUid) return;
        const { data, error } = await supabase.from("v_user_company_profile").select("*").eq("auth_user_id", authUid).single();
        if (!error && data) {
            setClientId(data.client_id);
            try { localStorage.setItem(LS_KEYS.clientId, data.client_id); } catch {}
            setHeaderInfo({ user_name_en: data.user_name_en, user_name_ar: data.user_name_ar, client_name_en: data.client_name_en, client_name_ar: data.client_name_ar, client_logo_filename: data.client_logo_filename });
            setClient({ id: data.client_id, name: data.client_name_en, name_ar: data.client_name_ar, logo_url: data.client_logo_filename });
        }
    }, []);
    
    useEffect(() => { resolveClientAndDetails(); }, [resolveClientAndDetails]);

    useEffect(() => {
        if (!clientId || filtersLoading) return;
        fetchClientMarkets();
        fetchClientTeamLeaders();
        fetchTeamLeaderMarketLinks();
    }, [clientId, filtersLoading, fetchClientMarkets, fetchClientTeamLeaders, fetchTeamLeaderMarketLinks]);

    useEffect(() => {
        if (!clientId || filtersLoading) return;
        fetchAvailabilityStats();
        fetchVisitCards();
        fetchPresenceVisitTransit();
    }, [clientId, filtersLoading, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader, dateFrom, dateTo, fetchAvailabilityStats, fetchVisitCards, fetchPresenceVisitTransit]);

    const handleDateFromChange = (date: Date | null) => {
        setDateFrom(date);
        if (dateTo && date && date > dateTo) setDateTo(null);
    };
    
    const welcomeName = useMemo(() => {
        const fromView = isAr ? headerInfo?.user_name_ar : headerInfo?.user_name_en;
        return fromView || user?.username || "";
    }, [headerInfo, isAr, user?.username]);

    const clientDisplayName = useMemo(() => {
        const fallback = isAr ? "اسم الشركة" : "Company Name";
        if (!headerInfo) return client?.name || client?.name_ar || fallback;
        const fromView = isAr ? headerInfo.client_name_ar || headerInfo.client_name_en : headerInfo.client_name_en || headerInfo.client_name_ar;
        return fromView || client?.name || client?.name_ar || fallback;
    }, [headerInfo, client, isAr]);

    const clientLogoUrl = useMemo(() => toAvatarPublicUrl(headerInfo?.client_logo_filename || client?.logo_url), [headerInfo?.client_logo_filename, client?.logo_url]);

    const {
    regionOptions,
    cityOptions,
    marketOptions,
    teamLeaderOptions,
  } = useMemo(() => {
    // 1. تحديد قائمة الأسواق المسموح بها بناءً على صلاحيات المستخدم
    const permissionedMarkets = allMarkets.filter(market => {
      if (userFilters?.allowed_markets === null) {
        return true;
      }
      if (Array.isArray(userFilters?.allowed_markets)) {
        if (userFilters.allowed_markets.length === 0) return false;
        return market.store ? userFilters.allowed_markets.includes(market.store) : false;
      }
      return false;
    });

    // 2. تحديد قادة الفرق المسموح بهم بناءً على صلاحيات المستخدم
    const permissionedTeamLeaders = teamLeaders.filter(tl => {
      if (userFilters?.Team_leader === null) {
        return true;
      }
      if (Array.isArray(userFilters?.Team_leader)) {
        if (userFilters.Team_leader.length === 0) return false;
        return userFilters.Team_leader.includes(tl.id);
      }
      return false;
    });

    // 3. فلترة الخيارات بناءً على اختيارات المستخدم الحالية
    let marketsFilteredByTL = permissionedMarkets;
    if (selectedTeamLeader) {
      const marketIdsForTl = new Set(tlMarketMap[selectedTeamLeader] || []);
      marketsFilteredByTL = permissionedMarkets.filter(m => marketIdsForTl.has(m.id));
    }
    
    let marketsFilteredByGeo = permissionedMarkets;
    if (selectedRegion) marketsFilteredByGeo = marketsFilteredByGeo.filter(m => m.region === selectedRegion);
    if (selectedCity) marketsFilteredByGeo = marketsFilteredByGeo.filter(m => m.city === selectedCity);
    if (selectedMarketName) marketsFilteredByGeo = marketsFilteredByGeo.filter(m => m.store === selectedMarketName);

    // 4. توليد القوائم النهائية للـ dropdowns
    const finalRegionOptions =
  [...new Set(marketsFilteredByTL
    .map(m => m.region)
    .filter((x): x is string => typeof x === 'string' && x.length > 0) // 👈 بدّل filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'ar'));

    let cityOptionSource = marketsFilteredByTL;
    if (selectedRegion) {
      cityOptionSource = cityOptionSource.filter(m => m.region === selectedRegion);
    }
    const finalCityOptions =
  [...new Set(
    cityOptionSource
      .map(m => m.city)
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
  )].sort((a, b) => a.localeCompare(b, 'ar'));


    let marketOptionSource = marketsFilteredByTL;
    if (selectedRegion) marketOptionSource = marketOptionSource.filter(m => m.region === selectedRegion);
    if (selectedCity) marketOptionSource = marketOptionSource.filter(m => m.city === selectedCity);
    const finalMarketOptions =
  [...new Set(
    marketOptionSource
      .map(m => m.store)
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
  )].sort((a, b) => a.localeCompare(b, 'ar'));

      
    const relevantMarketIds = new Set(marketsFilteredByGeo.map(m => m.id));
    const finalTeamLeaderOptions = permissionedTeamLeaders.filter(tl => {
      if (!selectedRegion && !selectedCity && !selectedMarketName) return true;
      const tlMarkets = tlMarketMap[tl.id] || [];
      return tlMarkets.some(marketId => relevantMarketIds.has(marketId));
    });

        // =============================================================
        // START: التعديل المطلوب هنا
        // =============================================================
    return {
            // إذا كانت هناك منطقة افتراضية محددة، استخدمها، وإلا اعرض كل الخيارات المتاحة
      regionOptions: userFilters?.default_region?.length ? userFilters.default_region : finalRegionOptions,
            // إذا كانت هناك مدينة افتراضية محددة، استخدمها، وإلا اعرض كل الخيارات المتاحة
      cityOptions: userFilters?.default_city?.length ? userFilters.default_city : finalCityOptions,
            // (جديد) إذا كانت هناك أسواق مسموح بها، استخدمها، وإلا اعرض كل الخيارات المتاحة
      marketOptions: userFilters?.allowed_markets?.length ? userFilters.allowed_markets.sort((a: string, b: string) => a.localeCompare(b, 'ar')) : finalMarketOptions,
            // (جديد) إذا كان هناك قادة فرق محددين، اعرضهم، وإلا اعرض كل الخيارات المتاحة
      teamLeaderOptions: userFilters?.Team_leader?.length ? permissionedTeamLeaders : finalTeamLeaderOptions,
    };
        // =============================================================
        // END: نهاية التعديل
        // =============================================================

  }, [allMarkets, teamLeaders, userFilters, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader, tlMarketMap]);

    const orderedStats = useMemo(() => {
        const presence = presenceSeconds, visit = visitSeconds, transit = transitSeconds;
        const visitPctTime = presence ? (visit / presence) * 100 : 0;
        const transitPctTime = presence ? (transit / presence) * 100 : 0;
        const base: Record<string, { value: number | string; percentage: number }> = {
            "Total Visits": { value: totalVisits, percentage: 100 },
            "Completed Visits": { value: finishedVisits, percentage: finishedPct },
            "False Visits": { value: unfinishedVisits, percentage: unfinishedPct },
            "Completed %": { value: finishedPct, percentage: finishedPct },
            "False %": { value: unfinishedPct, percentage: unfinishedPct },
            "Total Items": { value: totalProducts, percentage: 100 },
            "Total Available": { value: totalAvailable, percentage: totalProducts ? (totalAvailable / totalProducts) * 100 : 0 },
            "Not Available": { value: totalUnavailable, percentage: totalProducts ? (totalUnavailable / totalProducts) * 100 : 0 },
            "Avg Visit Time": { value: fmtHHMM(visit), percentage: visitPctTime },
            "Total Travel Time": { value: fmtHHMM(transit), percentage: transitPctTime },
        };
        const top = ORDER_TOP.map((label) => ({ label: label as string, ...base[label] }));
        const bottom = ORDER_BOTTOM.map((label) => ({ label: label as string, ...base[label] }));
        return [...top, ...bottom];
    }, [totalVisits, finishedVisits, unfinishedVisits, finishedPct, unfinishedPct, totalProducts, totalAvailable, totalUnavailable, presenceSeconds, visitSeconds, transitSeconds]);
    
    const goChangePassword = useCallback(() => { router.push("/change-password"); }, [router]);
    const goToDetailedReports = useCallback(() => { const params = new URLSearchParams(); if (clientId) params.set("clientId", clientId); if (selectedRegion) params.set("region", selectedRegion); if (selectedCity) params.set("city", selectedCity); if (selectedMarketName) params.set("market", selectedMarketName); if (selectedTeamLeader) params.set("tl", selectedTeamLeader); if (dateFrom) params.set("from", ksaDate(dateFrom)); if (dateTo) params.set("to", ksaDate(dateTo)); router.push(`/admin/reports?${params.toString()}`); }, [router, clientId, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader, dateFrom, dateTo]);
    const goToVisitRequests = useCallback(() => { const params = new URLSearchParams(); if (clientId) params.set("clientId", clientId); if (selectedRegion) params.set("region", selectedRegion); if (selectedCity) params.set("city", selectedCity); if (selectedMarketName) params.set("market", selectedMarketName); if (selectedTeamLeader) params.set("tl", selectedTeamLeader); if (dateFrom) params.set("from", ksaDate(dateFrom)); if (dateTo) params.set("to", ksaDate(dateTo)); router.push(`/admin/visit-requests?${params.toString()}`); }, [router, clientId, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader, dateFrom, dateTo]);
    const goToYesterdaysVisits = useCallback(() => { const y = new Date(); y.setDate(y.getDate() - 1); const yesterday = ksaDate(y); const params = new URLSearchParams(); if (clientId) params.set("clientId", clientId); if (selectedRegion) params.set("region", selectedRegion); if (selectedCity) params.set("city", selectedCity); if (selectedMarketName) params.set("market", selectedMarketName); if (selectedTeamLeader) params.set("tl", selectedTeamLeader); params.set("from", yesterday); params.set("to", yesterday); router.push(`/admin/yesterday-visits?${params.toString()}`); }, [router, clientId, selectedRegion, selectedCity, selectedMarketName, selectedTeamLeader]);

    if (booting || filtersLoading) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
                <div style={{ padding: 24, borderRadius: 8, background: "var(--card)", border: "1px solid var(--divider)" }}>
                    {isAr ? "جارٍ التحقق وتحميل الإعدادات…" : "Checking session & loading settings…"}
                </div>
            </div>
        );
    }

    if (!user) { return <p style={{ padding: "2rem" }}>Loading…</p>; }

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                <div style={{ width: "min(1100px, 94vw)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--card)", border: "1px solid var(--divider)", borderRadius: 12, padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        {clientLogoUrl ? (<Image src={clientLogoUrl} alt="Client Logo" width={36} height={36} style={{ borderRadius: 8, objectFit: "contain", cursor: "pointer" }} onClick={() => setLogoModalOpen(true)} />) : (<div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--chip-bg)", border: "1px solid var(--divider)" }} />)}
                        <div style={{ lineHeight: 1.25, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isAr ? "مرحبًا" : "Welcome"} {welcomeName}</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        <div title={clientDisplayName || ""} style={{ fontWeight: 700, color: "var(--text)", maxWidth: "44vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "clamp(14px, 2.4vw, 20px)" }}>{clientDisplayName}</div>
                        <button onClick={goChangePassword} style={{ padding: "8px 12px", borderRadius: 10, background: "var(--card)", border: "1px solid var(--divider)", color: "var(--text)", fontSize: 13, whiteSpace: "nowrap", cursor: "pointer" }}>🔒 {isAr ? "تغيير كلمة المرور" : "Change Password"}</button>
                    </div>
                </div>
            </div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 12, marginBottom: 12 }}>
                    <div className="filtersRow no-scrollbar">
                        <div style={capsuleStyle}>
                            {/* ====== START: REVISED onChange LOGIC ====== */}
                            <CapsuleItem label={isAr ? "المنطقة" : "Region"}>
                                <select 
                                    value={selectedRegion} 
                                    onChange={(e) => { 
                                        setSelectedRegion(e.target.value);
                                        setSelectedCity("");      // Always reset child
                                        setSelectedMarketName(""); // Always reset grandchild
                                    }} 
                                    style={capsuleSelect} 
                                    disabled={loadingFilters || !!userFilters?.default_region?.[0]}
                                >
                                    {!userFilters?.default_region?.[0] && (<option value="">{isAr ? "الكل" : "All"}</option>)}
                                    {regionOptions.map((r) => (<option key={r} value={r}>{r}</option>))}
                                </select>
                            </CapsuleItem>
                           <CapsuleItem label={isAr ? "المدينة" : "City"}>
                <select 
                  value={selectedCity} 
                  onChange={(e) => { 
                    const newCity = e.target.value;
                    setSelectedCity(newCity);
                    setSelectedMarketName(""); // أعد تعيين الفلتر الأبناء

                    // ===== الإضافة الجديدة هنا =====
                    // عند اختيار مدينة، قم بتحديث المنطقة تلقائيًا
                    if (newCity) {
                      const marketInCity = allMarkets.find(m => m.city === newCity);
                      if (marketInCity && marketInCity.region) {
                        setSelectedRegion(marketInCity.region);
                      }
                    }
                    // ==========================
                  }} 
                  style={capsuleSelect} 
                  disabled={loadingFilters || !!userFilters?.default_city?.[0]}
                >
                  {!userFilters?.default_city?.[0] && (<option value="">{isAr ? "الكل" : "All"}</option>)}
                  {cityOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </CapsuleItem>
                           <CapsuleItem label={isAr ? "السوق" : "Market"}>
                <select 
                  value={selectedMarketName} 
                  onChange={(e) => {
                    const newMarketName = e.target.value;
                    setSelectedMarketName(newMarketName);

                    // ===== الإضافة الجديدة هنا =====
                    // عند اختيار سوق، قم بتحديث المدينة والمنطقة تلقائيًا
                    if (newMarketName) {
                      const marketDetails = allMarkets.find(m => m.store === newMarketName);
                      if (marketDetails) {
                        setSelectedCity(marketDetails.city || "");
                        setSelectedRegion(marketDetails.region || "");
             
                                            }
                                        }
                                    }} 
                                    style={capsuleSelect} 
                                    disabled={loadingFilters || (!!userFilters?.allowed_markets?.length && userFilters.allowed_markets.length === 1)}
                                >
                                    {(!userFilters?.allowed_markets?.[0] || userFilters.allowed_markets.length > 1) && (<option value="">{isAr ? "الكل" : "All"}</option>)}
                                    {marketOptions.map((name) => (<option key={name} value={name}>{name}</option>))}
                                </select>
                            </CapsuleItem>
                            <CapsuleItem label={isAr ? "قائد الفريق" : "Team Leader"}>
                                <select 
                                    value={selectedTeamLeader} 
                                    onChange={(e) => {
                                        setSelectedTeamLeader(e.target.value);
                                        // Reset geo filters to prevent inconsistent state
                                        setSelectedRegion("");
                                        setSelectedCity("");
                                        setSelectedMarketName("");
                                    }} 
                                    style={capsuleSelect} 
                                    disabled={loadingFilters || !!userFilters?.Team_leader?.[0]}
                                >
                                    {!userFilters?.Team_leader?.[0] && (<option value="">{isAr ? "الكل" : "All"}</option>)}
                                    {teamLeaderOptions.map((t) => (<option key={t.id} value={t.id}>{isAr ? t.arabic_name || t.username : t.username}</option>))}
                                </select>
                            </CapsuleItem>
                            {/* ====== END: REVISED onChange LOGIC ====== */}
                            <CapsuleItem label={isAr ? "من" : "Date From"}>
                                <DatePicker selected={dateFrom} onChange={handleDateFromChange} selectsStart startDate={dateFrom} endDate={dateTo} dateFormat="yyyy-MM-dd" placeholderText={isAr ? "اختر تاريخ" : "Select date"} className="capsule-datepicker" />
                            </CapsuleItem>
                            <CapsuleItem label={isAr ? "إلى" : "Date To"}>
                                <DatePicker selected={dateTo} onChange={(date) => setDateTo(date)} selectsEnd startDate={dateFrom} endDate={dateTo} minDate={dateFrom || undefined} dateFormat="yyyy-MM-dd" placeholderText={isAr ? "اختر تاريخ" : "Select date"} className="capsule-datepicker" />
                            </CapsuleItem>
                            <button onClick={resetFilters} style={resetBtnStyle} title={isAr ? "إعادة تعيين الفلاتر" : "Reset Filters"}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-9 9m-9-9a9 9 0 0 1 9-9 9 9 0 0 1 6.2 2.7L12 9H5"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 20, marginBottom: 20 }}>
                    {orderedStats.slice(0, 5).map((stat, idx) => (<StatCard key={`top-${idx}`} stat={stat} isArabic={isAr} />))}
                </div>
                <hr style={{ margin: "0 20px 20px", border: "none", borderTop: "1px solid var(--divider)" }} />
                <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 20, marginBottom: 20 }}>
                    {orderedStats.slice(5).map((stat, idx) => (<StatCard key={`bottom-${idx}`} stat={stat} isArabic={isAr} />))}
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", paddingBottom: 32, flexWrap: "wrap" }}>
                    {(userFilters?.notifications ?? true) && (
                        <button style={primaryBtnStyle} onClick={() => router.push("/admin/notifications")}>
                            {isAr ? "الإشعارات" : "Notifications"}
                        </button>
                    )}
                    <button style={primaryBtnStyle} onClick={goToDetailedReports}>
                        {isAr ? "تقارير الزياره" : "Visit Report"}
                    </button>
                    {(userFilters?.requests ?? true) && (
                        <button style={primaryBtnStyle} onClick={goToVisitRequests}>
                            {isAr ? "طلبات الزياره" : "Visit Requests"}
                        </button>
                    )}
                    <button style={primaryBtnStyle} onClick={goToYesterdaysVisits}>
                        {isAr ? "زيارات أمس" : "Yesterday’s Visits"}
                    </button>
                </div>
                {logoModalOpen && (<div style={overlayStyle} onClick={() => setLogoModalOpen(false)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0 }}>{clientDisplayName}</h3>
                        {clientLogoUrl && (<Image src={clientLogoUrl} alt="Client Logo Large" width={250} height={250} style={{ objectFit: "contain", margin: "20px 0" }} />)}
                        <button onClick={() => setLogoModalOpen(false)} style={primaryBtnStyle}>{isAr ? "إغلاق" : "Close"}</button>
                    </div>
                </div>)}
                <style jsx global>{`
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                    .filtersRow { width: min(1100px, 94vw); display: flex; overflow-x: auto; padding: 6px 8px; scroll-snap-type: x mandatory; }
                    .filtersRow > * { scroll-snap-align: start; }
                    @media (min-width: 640px) { .filtersRow { overflow-x: visible; } }
                    select option { color: #000; background: #fff; }
                    .filtersRow select { color: var(--input-text); background-color: transparent; }
                    .capsule-datepicker { border: none !important; outline: none !important; background-color: transparent !important; color: var(--input-text) !important; font-size: 13px !important; min-width: 110px !important; padding: 0 !important; width: 100%; }
                    .capsule-datepicker::placeholder { color: var(--muted); }
                    .react-datepicker-popper { z-index: 10; }
                    .react-datepicker__header { background-color: var(--card) !important; }
                    .react-datepicker__month-container { background-color: var(--card); border: 1px solid var(--divider); }
                    .react-datepicker__current-month, .react-datepicker-time__header, .react-datepicker-year-header, .react-datepicker__day-name, .react-datepicker__day, .react-datepicker__time-name { color: var(--text) !important; }
                    .react-datepicker__day--disabled { opacity: 0.3; }
                `}</style>
        </div>
    );
}

// ========= Small components & styles =========
const capsuleStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--card)", border: "1px solid var(--divider)", borderRadius: 9999, padding: 6, whiteSpace: "nowrap" };
const resetBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '50%', width: 38, height: 38, color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 };
const itemShell: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--input-bg)", border: "1px solid var(--input-border)", borderRadius: 9999, padding: "6px 10px", whiteSpace: "nowrap" };
const itemLabel: React.CSSProperties = { fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" };
const chevronStyle: React.CSSProperties = { fontSize: 10, opacity: 0.7, marginInlineStart: 2 };
const baseField: React.CSSProperties = { border: "none", outline: "none", backgroundColor: "transparent", color: "var(--input-text)", fontSize: 13, minWidth: 90 };
const capsuleSelect: React.CSSProperties = { ...baseField, appearance: "none", paddingInlineEnd: 14 };
function CapsuleItem({ label, children }: { label: string; children: React.ReactNode }) { return (<div style={itemShell}><span style={itemLabel}>{label}</span><span style={chevronStyle}>▾</span>{children}</div>); }
const primaryBtnStyle: React.CSSProperties = { backgroundColor: "var(--accent)", color: "var(--accent-foreground)", padding: "10px 16px", border: "none", borderRadius: 10, fontWeight: 800, cursor: "pointer" };
function StatCard({ stat, isArabic }: { stat: { value: number | string; label: string; percentage: number }; isArabic: boolean }) {
    const labels: Record<string, string> = { "Total Visits": isArabic ? "إجمالي الزيارات" : "Total Visits", "Completed Visits": isArabic ? "الزيارات المكتملة" : "Completed Visits", "False Visits": isArabic ? "الزيارات غير المكتملة" : "False Visits", "Completed %": isArabic ? "نسبة الزيارات المكتملة" : "Completed %", "False %": isArabic ? "نسبة الزيارات غير المكتملة" : "False %", "Total Available": isArabic ? "إجمالي المنتجات المتاحة" : "Total Available", "Not Available": isArabic ? "اجمالي المنتجات غير المتاحة" : "Not Available", "Avg Visit Time": isArabic ? "إجمالي وقت الزيارة" : "Avg Visit Time", "Total Travel Time": isArabic ? "إجمالي وقت التنقل" : "Total Travel Time", "Total Items": isArabic ? "إجمالي الأصناف" : "Total Items" };
    const isPercentCard = stat.label.includes("%");
    return (<div style={{ width: 160, textAlign: "center", backgroundColor: "var(--card)", border: "1px solid var(--divider)", borderRadius: 12, padding: 14 }}><div style={{ width: 110, height: 110, margin: "0 auto", display: "grid", placeItems: "center" }}>{isPercentCard ? (<CircularProgressbarWithChildren value={typeof stat.percentage === "number" ? stat.percentage : 0} styles={buildStyles({ textColor: "var(--text)", pathColor: "var(--accent)", trailColor: "var(--chip-bg)" })}><div style={{ lineHeight: 1, display: "flex", flexDirection: "column", alignItems: "center" }}><div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>{typeof stat.value === "number" ? stat.value.toFixed(2) : stat.value}</div><div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>%</div></div></CircularProgressbarWithChildren>) : (<CircularProgressbar value={typeof stat.percentage === "number" ? stat.percentage : 0} text={`${stat.value}`} styles={buildStyles({ textColor: "var(--text)", pathColor: "var(--accent)", trailColor: "var(--chip-bg)" })} />)}</div><p style={{ marginTop: 10, fontSize: 13 }}>{labels[stat.label] ?? stat.label}</p></div>);
}
const overlayStyle: React.CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalStyle: React.CSSProperties = { background: "var(--card)", padding: "2rem", borderRadius: "12px", border: "1px solid var(--divider)", textAlign: "center", color: "var(--text)" };