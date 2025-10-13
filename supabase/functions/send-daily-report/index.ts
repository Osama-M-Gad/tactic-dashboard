// Edge Function: send-daily-report
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ========= Types ========= */
type UUID = string;

type Filters =
  | {
      region?: string;
      city?: string;
      store?: string;
      team_leader_id?: UUID;
      status?: string;
    }
  | null;

type ScheduleRow = {
  id: UUID;
  client_id: UUID | null;
  recipient_email: string;
  filters: Filters;
  is_active: boolean;
};

type VisitRow = {
  user_name: string | null;
  team_leader_name: string | null;
  market_store: string | null;
  market_branch: string | null;
  started_at: string | null;
  finished_at: string | null;
  status: string | null;
  end_reason: string | null;
};

/* ========= CORS ========= */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ========= Utils ========= */
function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-EG", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Riyadh",
  });
}

function diffClock(start: string | null, end: string | null): string {
  if (!start || !end) return "-";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return "-";
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
        s
      ).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderTable(rows: VisitRow[], dateLabel: string): string {
  const head = `
    <h2 style="margin:0 0 10px;font-family:Arial">زيارات أمس (${dateLabel})</h2>
    <table border="1" cellspacing="0" cellpadding="6"
           style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
      <thead style="background:#f2f2f2;text-align:center">
        <tr>
          <th>المستخدم</th>
          <th>قائد الفريق</th>
          <th>السوق</th>
          <th>الفرع</th>
          <th>وقت البدء</th>
          <th>وقت الانتهاء</th>
          <th>مدة الزيارة</th>
          <th>الحالة</th>
        </tr>
      </thead>
      <tbody>`;
  const body =
    rows
      .map(
        (r) => `
        <tr style="text-align:center">
          <td>${r.user_name ?? "-"}</td>
          <td>${r.team_leader_name ?? "-"}</td>
          <td>${r.market_store ?? "-"}</td>
          <td>${r.market_branch ?? "-"}</td>
          <td>${fmtTime(r.started_at)}</td>
          <td>${fmtTime(r.finished_at)}</td>
          <td>${diffClock(r.started_at, r.finished_at)}</td>
          <td>${r.status ?? (r.end_reason ? "منتهية" : "معلقة")}</td>
        </tr>`
      )
      .join("") ||
    `<tr><td colspan="8" style="text-align:center;color:#888">لا توجد زيارات</td></tr>`;
  return `${head}${body}</tbody></table>`;
}

function ksaYesterdayISODate(): string {
  // أمس بتوقيت الرياض كـ YYYY-MM-DD
  const nowUtc = new Date();
  const ksaNow = new Date(nowUtc.getTime() + 3 * 60 * 60 * 1000); // UTC+3
  const ksaY = new Date(ksaNow);
  ksaY.setUTCDate(ksaNow.getUTCDate() - 1);
  return ksaY.toISOString().slice(0, 10);
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyStatusFilter(q: any, status?: string) {
  const st = norm(status);
  if (!st) return q;
  if (["مكتملة", "finished"].some((x) => st.includes(norm(x)))) {
    // finished: بدأ وانتهى وبدون end_reason
    return q.is("end_reason", null).not("started_at", "is", null).not("finished_at", "is", null);
  } else if (["منتهية", "ended"].some((x) => st.includes(norm(x)))) {
    // ended: end_reason موجود
    return q.not("end_reason", "is", null);
  } else if (["معلقة", "pending"].some((x) => st.includes(norm(x)))) {
    // pending: end_reason NULL وأيّ من البدء/الانتهاء مفقود
    return q.is("end_reason", null).or("finished_at.is.null,started_at.is.null");
  }
  return q;
}

/* ========= Handler ========= */
serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PROJECT_URL = Deno.env.get("PROJECT_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const MAIL_FROM = Deno.env.get("MAIL_FROM") || "no-reply@tai.com.sa";
    const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

    if (!PROJECT_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required secrets" }),
        { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    const headerCron = req.headers.get("x-cron-key");
    const isCron = !!CRON_SECRET && headerCron === CRON_SECRET;
    const hasBearer = !!req.headers.get("authorization");

    if (!(isCron || hasBearer)) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Body (للوضع اليدوي فقط)
    type ManualBody = {
      client_id?: string;
      user_id?: string;
      region?: string;
      city?: string;
      store?: string;
      status?: string;
      recipient_emails?: string[];
    };
    let bodyJson: ManualBody = {};
    if (!isCron) {
      try {
        const raw = await req.json();
        if (raw && typeof raw === "object") {
          const b = raw as Record<string, unknown>;
          bodyJson = {
            client_id: typeof b.client_id === "string" ? b.client_id : undefined,
            user_id: typeof b.user_id === "string" ? b.user_id : undefined,
            region: typeof b.region === "string" ? b.region : undefined,
            city: typeof b.city === "string" ? b.city : undefined,
            store: typeof b.store === "string" ? b.store : undefined,
            status: typeof b.status === "string" ? b.status : undefined,
            recipient_emails:
              Array.isArray(b.recipient_emails) && b.recipient_emails.every((x) => typeof x === "string")
                ? (b.recipient_emails as string[])
                : undefined,
          };
        }
      } catch {
        /* ignore non-JSON */
      }
    }

    const sb = createClient(PROJECT_URL, SERVICE_ROLE_KEY);
    const dateY = ksaYesterdayISODate();

    // Helper to build visits query from plain filters (لا يعتمد على فلاتر الجدول)
    const buildVisits = async (args: {
      client_id?: string;
      user_id?: string;
      region?: string;
      city?: string;
      store?: string;
      status?: string;
      team_leader_id?: string;
    }) => {
      let vq = sb
        .from("visits_details_v")
        .select(
          "user_name, team_leader_name, market_store, market_branch, started_at, finished_at, status, end_reason, market_region, market_city, client_id",
          { count: "exact" }
        )
        .eq("snapshot_date_raw", dateY);

      if (args.client_id) vq = vq.eq("client_id", args.client_id);
      if (args.user_id) vq = vq.eq("user_id", args.user_id);
      if (args.team_leader_id) vq = vq.eq("team_leader_id", args.team_leader_id);
      if (args.region) vq = vq.eq("market_region", args.region);
      if (args.city) vq = vq.eq("market_city", args.city);
      if (args.store) vq = vq.eq("market_store", args.store);
      vq = applyStatusFilter(vq, args.status);

      const { data, error } = await vq.order("started_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VisitRow[];
    };

    const sendEmail = async (to: string, html: string) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: MAIL_FROM,
          to,
          subject: "Daily Report",
          html,
        }),
      });
      return res.ok;
    };

    let totalSent = 0;

    if (isCron) {
      // ===== وضع الكرون: نقرأ الفلاتر من الجدول ونرسل لكل مستلم حسب صفه =====
      const { data: schedules, error: sErr } = await sb
        .from("scheduled_email_reports")
        .select("id, client_id, recipient_email, filters, is_active")
        .eq("is_active", true);

      if (sErr) throw sErr;
      const list = (schedules ?? []) as ScheduleRow[];

      for (const s of list) {
        const f = s.filters ?? {};
        const visits = await buildVisits({
          client_id: s.client_id ?? undefined,
          team_leader_id: f.team_leader_id ?? undefined,
          region: f.region ?? undefined,
          city: f.city ?? undefined,
          store: f.store ?? undefined,
          status: f.status ?? undefined,
        });

        const html = renderTable(visits, dateY);
        try {
          if (await sendEmail(s.recipient_email, html)) totalSent++;
        } catch (err) {
          console.log("Resend error (cron)", s.recipient_email, String(err));
        }
      }

      return new Response(JSON.stringify({ ok: true, mode: "cron", sent: totalSent }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // ===== الوضع اليدوي: نبني الاستعلام من اختيارات الواجهة فقط، ونحدد المستلمين كما هو مذكور =====
    const visits = await buildVisits({
      client_id: bodyJson.client_id,
      user_id: bodyJson.user_id,
      region: bodyJson.region,
      city: bodyJson.city,
      store: bodyJson.store,
      status: bodyJson.status,
    });
    const html = renderTable(visits, dateY);

    // المستلمين
    let recipients: string[] = [];
    if (Array.isArray(bodyJson.recipient_emails) && bodyJson.recipient_emails.length > 0) {
      recipients = Array.from(new Set(bodyJson.recipient_emails.map((e) => e.trim()).filter(Boolean)));
    } else {
      // جميع المفعّلين (وممكن ننزلهم على client لو متحدد)
      let rq = sb
        .from("scheduled_email_reports")
        .select("recipient_email", { distinct: true })
        .eq("is_active", true);
      if (bodyJson.client_id) rq = rq.eq("client_id", bodyJson.client_id);
      const { data: rec, error: rErr } = await rq.order("recipient_email", { ascending: true });
      if (rErr) throw rErr;
      recipients = Array.from(
        new Set((rec ?? []).map((r: { recipient_email: string }) => r.recipient_email).filter(Boolean))
      );
    }

    for (const to of recipients) {
      try {
        if (await sendEmail(to, html)) totalSent++;
      } catch (err) {
        console.log("Resend error (manual)", to, String(err));
      }
    }

    return new Response(JSON.stringify({ ok: true, mode: "manual", sent: totalSent }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }
});
