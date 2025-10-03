import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// امنع الـ SSG/Prerender واشتغل في Node runtime
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// util: أنشئ Supabase client داخل الهاندلر فقط
function getSupabaseServerClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  // في الراوتات السيرفرية استخدم service_role لو بتكتب/تعدّل
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY || // fallback لو عندك اسم مختلف
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // آخر حل لو بتقرأ بس

  if (!url || !key) {
    // رسالة تشخيصية مفصلة بدل "supabaseKey is required"
    throw new Error(
      `Missing Supabase envs:
        NEXT_PUBLIC_SUPABASE_URL: ${!!process.env.NEXT_PUBLIC_SUPABASE_URL}
        SUPABASE_URL:               ${!!process.env.SUPABASE_URL}
        SUPABASE_SERVICE_ROLE_KEY:  ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}
        SUPABASE_ANON_KEY:          ${!!process.env.SUPABASE_ANON_KEY}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

type UpsertClient = {
  client_code: string;
  name_ar: string;
  name_en?: string | null;
  tax_number?: string | null;
  phone?: string | null;
  email?: string | null;
  default_language?: "ar" | "en";
  active?: boolean;
  start_date?: string | null;
  markets?: string[];
  categories?: string[];
  app_steps?: string[];
};

const toStr = (v: unknown): string | null => (v == null ? null : String(v));
const toStrTrim = (v: unknown): string => String(v ?? "").trim();

const toBool = (v: unknown): boolean | undefined => {
  if (v === true || v === false) return v;
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return undefined;
  if (["true", "1", "yes"].includes(s)) return true;
  if (["false", "0", "no"].includes(s)) return false;
  return undefined;
};

const toStrArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  const s = String(v ?? "").trim();
  return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
};

export async function POST(req: Request) {
  try {
    // أنشئ العميل هنا (وقت الطلب فقط)
    const supabase = getSupabaseServerClient();

    const body = (await req.json()) as { clients?: unknown };
    const raw = Array.isArray(body.clients) ? body.clients : [];

    const payload: UpsertClient[] = raw.map((item): UpsertClient => {
      const r = (item ?? {}) as Record<string, unknown>;
      const client_code = toStrTrim(r.client_code);
      const name_ar = toStrTrim(r.name_ar);

      return {
        client_code,
        name_ar,
        name_en: toStr(r.name_en),
        tax_number: toStr(r.tax_number),
        phone: toStr(r.phone),
        email: toStr(r.email),
        default_language: ((): "ar" | "en" | undefined => {
          const v = toStrTrim(r.default_language).toLowerCase();
          return v === "ar" || v === "en" ? (v as "ar" | "en") : undefined;
        })(),
        active: toBool(r.active),
        start_date: toStr(r.start_date),
        markets: toStrArray(r.markets),
        categories: toStrArray(r.categories),
        app_steps: toStrArray(r.app_steps),
      };
    });

    if (payload.length === 0) {
      return NextResponse.json({ error: "no clients" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("clients")
      .upsert(payload, { onConflict: "client_code" })
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ upserted: data?.length ?? 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
