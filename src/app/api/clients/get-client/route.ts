import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // سيرفر فقط
);

export async function POST(req: Request) {
  try {
    const { client_code, id } = await req.json();
    const q = supabase.from("clients").select("*").limit(1);

    const { data, error } = client_code
      ? await q.eq("client_code", client_code)
      : await q.eq("id", id);

    if (error) return NextResponse.json({ client: null, error: error.message }, { status: 400 });

    return NextResponse.json({ client: data?.[0] ?? null });
  } catch (e: any) {
    return NextResponse.json({ client: null, error: String(e?.message ?? e) }, { status: 500 });
  }
}
