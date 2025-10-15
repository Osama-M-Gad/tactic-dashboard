  // src/app/admin/visit-steps/StepDataTable.tsx
  "use client";

  import { useCallback, useEffect, useMemo, useState } from "react";
  import { createClient } from "@supabase/supabase-js";
  import { VISIT_STEPS, StepKey, StepConfig, StepColumn } from "@/utils/visitStepsMap";
  import { useLangTheme } from "@/hooks/useLangTheme";
  import SupaImg from "@/components/SupaImg";

  /* ===== Supabase ===== */
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  /* ===== Types ===== */
  type Row = Record<string, unknown>;

  type Props = {
    step: StepKey;
    pageSize?: number;
    visitId?: string | null; // نفلتر بيها حسب الزيارة
  };

  /* ===== helpers: قراءة آمنة بدون any ===== */
  function getStr(obj: Record<string, unknown> | undefined, key: string): string {
    const v = obj?.[key];
    if (typeof v === "string") return v;
    if (v == null) return "";
    return String(v);
  }
  function getId(obj: Record<string, unknown> | undefined): string {
    const v = obj?.["id"];
    if (typeof v === "string") return v;
    if (v == null) return "";
    return String(v);
  }

  /* ===== helpers: صور ===== */
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public`;
  const isAbsUrl = (u: string) => /^(https?:|data:|blob:)/i.test(u);

  function toPublicUrl(u?: string | null, bucketHint?: string): string {
    if (!u) return "";
    const s = String(u).trim();
    if (!s) return "";
    if (isAbsUrl(s)) return s;
    if (s.startsWith("/storage/v1/object/public/")) return `${SUPABASE_URL}${s}`;
    if (s.includes("/")) return `${PUBLIC_BASE}/${s}`;
    if (bucketHint) return `${PUBLIC_BASE}/${bucketHint}/${s}`;
    return `${PUBLIC_BASE}/${s}`;
  }
  function normalizeImageList(v: unknown, bucketHint?: string): string[] {
    if (Array.isArray(v)) {
      return v.map((x) => toPublicUrl(String(x), bucketHint)).filter(Boolean);
    }
    if (typeof v === "string") {
      const parts = v.split(/[\s,]+/).filter(Boolean);
      return parts.map((x) => toPublicUrl(x, bucketHint)).filter(Boolean);
    }
    if (v == null) return [];
    return [toPublicUrl(String(v), bucketHint)].filter(Boolean);
  }
/** طباعة خطأ مفيد بدل {} بدون استخدام any */
function printableError(e: unknown): Record<string, unknown> {
  if (e instanceof Error) {
    const out: Record<string, unknown> = { name: e.name, message: e.message };
    if (e.stack) out.stack = e.stack;
    return out;
  }
  if (typeof e === "object" && e !== null) {
    const obj = e as Record<string, unknown>;
    const keys = ["name", "message", "code", "details", "hint", "status", "stack"];
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      if (k in obj) out[k] = obj[k];
    }
    return Object.keys(out).length ? out : obj;
  }
  return { message: String(e) };
}
/** يتحقق أن القيمة سجل كائن بسيط {…} وليست Array أو null */
function isObjRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

  /* ===== component ===== */
  export default function StepDataTable({ step, pageSize = 25, visitId = null }: Props) {
    const { isArabic } = useLangTheme();
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [errMsg, setErrMsg] = useState<string | null>(null);

    // Lightbox
    const [viewer, setViewer] = useState<{ open: boolean; imgs: string[]; index: number; title?: string }>({
      open: false,
      imgs: [],
      index: 0,
      title: "",
    });
    const openViewer = (imgs: string[], title?: string, index = 0) =>
      setViewer({ open: true, imgs, index, title });
    const closeViewer = () => setViewer((v) => ({ ...v, open: false }));
    const prevImg = () =>
      setViewer((v) => ({ ...v, index: (v.index - 1 + v.imgs.length) % v.imgs.length }));
    const nextImg = () =>
      setViewer((v) => ({ ...v, index: (v.index + 1) % v.imgs.length }));

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

    // config
    const cfg: StepConfig = useMemo(() => VISIT_STEPS[step], [step]);
    const visibleCols = useMemo(
      () => cfg.columns.filter((c) => !(c.key === "visit_id" && visitId)),
      [cfg.columns, visitId]
    );

    // lookup cache (مثل user_id → اسم)
    const [lookups, setLookups] = useState<Record<string, Record<string, string>>>({});

    // جلب الصفحة
    const fetchPage = useCallback(async () => {
  setLoading(true);
  setErrMsg(null);

  try {
    // دي معلومات تشخيصية مفيدة وقت الديبج
    console.debug("[StepDataTable] fetch params", {
      table: cfg.table,
      select: cfg.select,
      defaultOrder: cfg.defaultOrder,
      page,
      pageSize,
      visitId,
    });

    const from = page * pageSize;
    const to = from + pageSize - 1;
    if (from < 0 || to < from) {
      throw new Error(`Invalid pagination: from=${from}, to=${to}, pageSize=${pageSize}`);
    }

    let q = supabase
      .from(cfg.table)
      .select(cfg.select, { count: "exact" })
      .range(from, to);

    if (visitId) q = q.eq("visit_id", visitId);
    if (cfg.defaultOrder) {
      q = q.order(cfg.defaultOrder.column, { ascending: cfg.defaultOrder.ascending });
    }

    const res = await q;

    if (res.error) {
      const err = res.error;
      // ابنِ رسالة واضحة بدون any
      let message = err.message || "Query failed";
      if (err.code) message += ` [code=${err.code}]`;
      if (err.details) message += ` | details: ${err.details}`;
      if ((err as unknown as { hint?: unknown }).hint) {
        message += ` | hint: ${String((err as unknown as { hint?: unknown }).hint)}`;
      }
      throw new Error(message);
    }

    const raw = res.data as unknown;
    const arr: Row[] = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
    setRows(arr);

    // ===== lookups (اختياري حسب cfg)
    if (cfg.lookups) {
      const next: Record<string, Record<string, string>> = {};

    for (const [colKey, lu] of Object.entries(cfg.lookups)) {
  const idsForLookup = Array.from(
    new Set(
      arr
        .map((r) => r[colKey])
        .filter((v): v is string | number => typeof v === "string" || typeof v === "number")
        .map((v) => String(v))
    )
  );
  if (idsForLookup.length === 0) continue;

  const lres = await supabase
    .from(lu.table)
    .select(lu.select)
    .in("id", idsForLookup);

  if (!lres.error && Array.isArray(lres.data)) {
    const map: Record<string, string> = {};
    const list = lres.data.filter(isObjRecord);

    for (const rec of list) {
      const id = getId(rec);
      const labelPrimary = getStr(rec, lu.labelField);
      const labelArabic = getStr(rec, "arabic_name");
      map[id] = (isArabic ? labelArabic : labelPrimary) || labelPrimary || labelArabic || id;
    }
    next[colKey] = map;
  } else if (lres.error) {
    console.warn("[StepDataTable] lookup error", printableError(lres.error));
  }
}


      setLookups(next);
    } else {
      setLookups({});
    }
  } catch (e: unknown) {
    // رسالة مستخدم مفهومة
    let msg = "Failed to fetch";
    if (e instanceof Error && e.message) msg = e.message;
    else if (typeof e === "object" && e !== null && "message" in e) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === "string") msg = m;
    }

    // اطبع تفاصيل مفيدة بدل {}
    console.error("[StepDataTable] fetch error", printableError(e));
    setErrMsg(msg);
    setRows([]);
  } finally {
    setLoading(false);
  }
}, [cfg, page, pageSize, visitId, isArabic]);


    // زي ما اتفقنا: لما الخطوة أو الزيارة تتغير، نرجّع لأول صفحة
    useEffect(() => {
      setPage(0);
    }, [step, visitId]);

    // نفّذ الجلب عند تغيّر deps
    useEffect(() => {
      fetchPage();
    }, [fetchPage]);

    return (
      <div className="mt-4">
        <div className="overflow-auto border border-[var(--divider)] rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--header-bg)] sticky top-0">
              <tr className="text-left">
                {visibleCols.map((col, idx) => (
                  <th
                    key={col.key + String(idx)}
                    className="px-3 py-2 whitespace-nowrap border-b border-[var(--divider)]"
                  >
                    {isArabic ? col.labelAr : col.labelEn}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4" colSpan={visibleCols.length}>
                    …loading
                  </td>
                </tr>
              ) : errMsg ? (
                <tr>
                  <td className="px-3 py-4 text-red-400" colSpan={visibleCols.length}>
                    {errMsg}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4" colSpan={visibleCols.length}>
                    {isArabic ? "لا توجد بيانات" : "No data"}
                  </td>
                </tr>
              ) : (
                rows.map((r, ridx) => (
                  <tr key={(r.id as string) ?? ridx} className="odd:bg-[var(--card)] even:bg-transparent">
                    {visibleCols.map((col) => {
                      const v = r[col.key as keyof Row];
                      // تطبيق lookup إن وجد
                      const lu = cfg.lookups?.[col.key];
                      const display =
                        lu && (typeof v === "string" || typeof v === "number")
                          ? (lookups[col.key]?.[String(v)] ?? v)
                          : v;

                      return (
                        <td key={col.key} className="px-3 py-2 border-t border-[var(--divider)] align-top">
                          <CellRenderer
                            value={display}
                            type={col.type}
                            bucketHint={col.bucketHint}
                            isArabic={isArabic}
                            onPreview={(imgs, title) => openViewer(imgs, title)}
                            column={col}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="px-3 py-2 rounded-xl border border-[var(--divider)] disabled:opacity-50"
          >
            {isArabic ? "السابق" : "Prev"}
          </button>
          <span className="opacity-80">{isArabic ? `صفحة ${page + 1}` : `Page ${page + 1}`}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || rows.length < pageSize}
            className="px-3 py-2 rounded-xl border border-[var(--divider)] disabled:opacity-50"
          >
            {isArabic ? "التالي" : "Next"}
          </button>
        </div>

        {/* Lightbox */}
        {viewer.open && (
          <div
            onClick={closeViewer}
            className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-[96vw] w-full max-h-[90vh] bg-[var(--card)] rounded-2xl p-3 border border-[var(--divider)]"
            >
              <div className="flex items-center justify-between mb-2">
                <strong className="text-sm">{viewer.title || ""}</strong>
                <button onClick={closeViewer} className="px-3 py-1 rounded-xl border border-[var(--divider)]">
                  ×
                </button>
              </div>

              <div className="relative w-full h-[70vh] bg-[var(--input-bg)] rounded-xl overflow-hidden">
                {/* زرار السابق */}
                {viewer.imgs.length > 1 && (
                  <button
                    onClick={prevImg}
                    className="absolute left-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-xl border border-[var(--divider)] bg-black/40 text-white"
                    title={isArabic ? "السابق" : "Prev"}
                  >
                    ‹
                  </button>
                )}

                {/* الصورة */}
                <SupaImg
                  src={viewer.imgs[viewer.index]}
                  alt="preview"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />

                {/* زرار التالي */}
                {viewer.imgs.length > 1 && (
                  <button
                    onClick={nextImg}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-xl border border-[var(--divider)] bg-black/40 text-white"
                    title={isArabic ? "التالي" : "Next"}
                  >
                    ›
                  </button>
                )}
              </div>

              {/* عدّاد + thumbnails صغيرة */}
              <div className="flex items-center justify-between mt-2">
                <div className="opacity-80 text-xs">
                  {viewer.index + 1} / {viewer.imgs.length}
                </div>
                {viewer.imgs.length > 1 && (
                  <div className="flex gap-2 overflow-auto">
                    {viewer.imgs.map((u, i) => (
                      <button
                        key={u + i}
                        className={`relative w-12 h-12 rounded border ${
                          i === viewer.index ? "border-[var(--accent)]" : "border-[var(--divider)]"
                        }`}
                        onClick={() => setViewer((v) => ({ ...v, index: i }))}
                        title={`${i + 1}`}
                      >
                        <SupaImg src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function CellRenderer({
    value,
    type = "text",
    bucketHint,
    isArabic,
    onPreview,
    column,
  }: {
    value: unknown;
    type?: "text" | "number" | "datetime" | "image" | "boolean";
    bucketHint?: string;
    isArabic: boolean;
    onPreview: (imgs: string[], title?: string) => void;
    column: StepColumn;
  }) {
    if (value == null) return <span className="opacity-60">—</span>;

    switch (type) {
      case "boolean": {
        const v = Boolean(value);
        return <span>{v ? (isArabic ? "نعم" : "Yes") : isArabic ? "لا" : "No"}</span>;
      }
      case "number": {
        const n = Number(value);
        return <span>{Number.isFinite(n) ? n.toLocaleString(isArabic ? "ar-EG" : "en-US") : String(value)}</span>;
      }
      case "datetime": {
        try {
          const d = new Date(String(value));
          return <span title={d.toISOString()}>{d.toLocaleString(isArabic ? "ar-EG" : "en-US")}</span>;
        } catch {
          return <span>{String(value)}</span>;
        }
      }
      case "image": {
        const imgs = normalizeImageList(value, bucketHint);
        if (imgs.length === 0) return <span className="opacity-60">—</span>;
        const first = imgs[0];
        return (
          <button
            type="button"
            className="block"
            onClick={() => onPreview(imgs, isArabic ? column.labelAr : column.labelEn)}
            title={isArabic ? "عرض" : "Preview"}
          >
            <div className="relative w-[64px] h-[64px] rounded-md overflow-hidden border border-[var(--divider)]">
              <SupaImg src={first} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </button>
        );
      }
      default:
        return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
    }
  }
