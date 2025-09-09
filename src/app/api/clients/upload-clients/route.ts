import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-only
);

export async function POST(req: Request) {
  try {
    const { clients = [] } = await req.json();
    if (!Array.isArray(clients) || !clients.length) {
      return NextResponse.json({ error: 'no clients' }, { status: 400 });
    }

    const payload = clients.map((c: any) => ({
      client_code: String(c.client_code).trim(),
      name_ar: String(c.name_ar).trim(),
      name_en: c.name_en ?? null,
      tax_number: c.tax_number ?? null,
      phone: c.phone ?? null,
      email: c.email ?? null,
      default_language: c.default_language ?? 'ar',
      active: c.active ?? true,
      start_date: c.start_date ?? null,
    }));

    const { data, error } = await supabase
      .from('clients')
      .upsert(payload, { onConflict: 'client_code' })
      .select('id');

    if (error) throw error;
    return NextResponse.json({ upserted: data?.length ?? 0 });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
