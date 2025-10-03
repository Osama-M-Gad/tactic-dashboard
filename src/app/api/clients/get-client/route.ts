import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ClientRow = {
  client_code: string;
  name_ar: string | null;
  name_en: string | null;
  tax_number: string | null;
  markets: string[];
  categories: string[];
  app_steps: string[];
};

export async function POST(req: Request) {
  try {
    const { client_code, id } = (await req.json()) as {
      client_code?: string;
      id?: string;
    };

    if (!client_code && !id) {
      return NextResponse.json({ error: "client_code or id required" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 });
    }

    const supabase = createClient(url, key);

    let query = supabase
      .from("clients")
      .select("client_code,name_ar,name_en,tax_number,markets,categories,app_steps")
      .limit(1);

    if (client_code) query = query.eq("client_code", client_code);
    if (id) query = query.eq("id", id);

    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const client: ClientRow = {
      client_code: data.client_code,
      name_ar: data.name_ar ?? null,
      name_en: data.name_en ?? null,
      tax_number: data.tax_number ?? null,
      markets: Array.isArray(data.markets) ? data.markets : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      app_steps: Array.isArray(data.app_steps) ? data.app_steps : [],
    };

    return NextResponse.json({ client });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
