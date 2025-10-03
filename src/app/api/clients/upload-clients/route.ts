import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ===== Supabase on server ===== */
function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing Supabase envs:
       NEXT_PUBLIC_SUPABASE_URL: ${!!process.env.NEXT_PUBLIC_SUPABASE_URL}
       SUPABASE_URL:               ${!!process.env.SUPABASE_URL}
       SUPABASE_SERVICE_ROLE_KEY:  ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}
       SUPABASE_ANON_KEY:          ${!!process.env.SUPABASE_ANON_KEY}
       NEXT_PUBLIC_SUPABASE_ANON_KEY: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ===== Types ===== */
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

/* ===== Helpers ===== */
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

function validateRow(r: UpsertClient): string[] {
  const errs: string[] = [];
  if (!r.client_code) errs.push("client_code is required");
  if (!r.name_ar) errs.push("name_ar is required");
  if (r.default_language && !["ar", "en"].includes(r.default_language)) errs.push("default_language must be ar|en");
  return errs;
}

function chunk<T>(arr: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ===== Handler ===== */
export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();

    const body = (await req.json()) as { clients?: unknown };
    const raw = Array.isArray(body.clients) ? body.clients : [];
    if (raw.length === 0) {
      return NextResponse.json({ error: "no clients" }, { status: 400 });
    }

    // map + validate
    const mapped: UpsertClient[] = raw.map((item) => {
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

    // pre-validation per row
    const errors: { index: number; messages: string[] }[] = [];
    mapped.forEach((row, i) => {
      const e = validateRow(row);
      if (e.length) errors.push({ index: i, messages: e });
    });
    if (errors.length) {
      return NextResponse.json({ error: "validation_failed", details: errors }, { status: 422 });
    }

    // upsert in chunks
    const chunks = chunk(mapped, 500);
    let upserted = 0;

    for (const part of chunks) {
      const { data, error } = await supabase
        .from("clients")
        .upsert(part, { onConflict: "client_code" })
        .select("id");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      upserted += data?.length ?? 0;
    }

    return NextResponse.json({ upserted });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
