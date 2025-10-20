// Edge Function: send-daily-report
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ========= Types ========= */
type UUID = string;

type ScheduleRow = {
  id: UUID;
  client_id: UUID | null;
  recipient_email: string;
  // filters تبقى موجودة بالجدول لكن احنا مش هنستخدمها هنا، الـ RPC بتطبّقها جوة الـ DB
  filters: unknown | null;
  is_active: boolean;
};

// شكل الصفوف الراجعة من get_report_visits (الحد الأدنى اللازم للتقرير)
type VisitRow = {
  user_name: string | null;
  team_leader_name: string | null;
  market_store: string | null;
  market_branch: string | null;
  /** ⬇⬇ أضف هذان الحقلان */
  market_region: string | null;
  market_city: string | null;
  started_at: string | null;
  finished_at: string | null;
  status: string | null;
  end_reason: string | null;
  jp_state?: "IN JP" | "OUT OF JP" | null;
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
  const filtered = rows.filter(
    (r) => !((r.status?.toLowerCase() === "pending") && (r.jp_state === "OUT OF JP"))
  );

  const head = `
    <h2 style="margin:0 0 10px;font-family:Arial">زيارات أمس (${dateLabel})</h2>
    <table border="1" cellspacing="0" cellpadding="6"
           style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
      <thead style="background:#f2f2f2;text-align:center">
        <tr>
          <th>المستخدم</th>
          <th>قائد الفريق</th>
          <th>المنطقه</th>
          <th>المدينه</th>
          <th>السوق</th>
          <th>الفرع</th>
          <th>وقت البدء</th>
          <th>وقت الانتهاء</th>
          <th>مدة الزيارة</th>
          <th>الحالة</th>
          <th>JP حالة</th>
        </tr>
      </thead>
      <tbody>`;

  const body = filtered.length
    ? filtered
        .map((r) => {
          const jp = (r.jp_state === "IN JP" || r.jp_state === "OUT OF JP") ? r.jp_state : "IN JP";

          return `
          <tr style="text-align:center">
            <td>${r.user_name ?? "-"}</td>
            <td>${r.team_leader_name ?? "-"}</td>
            <td>${r.market_region ?? "-"}</td>
            <td>${r.market_city ?? "-"}</td>
            <td>${r.market_store ?? "-"}</td>
            <td>${r.market_branch ?? "-"}</td>
            <td>${fmtTime(r.started_at)}</td>
            <td>${fmtTime(r.finished_at)}</td>
            <td>${diffClock(r.started_at, r.finished_at)}</td>
            <td>${r.status ?? (r.end_reason ? "ended" : "pending")}</td>
            <td>${jp}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="11" style="text-align:center;color:#888">لا توجد زيارات</td></tr>`;

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
// ✅ يسمح بنداء المجدول الداخلي من Supabase
const isScheduler = !!req.headers.get("x-schedule");

if (!(isCron || hasBearer || isScheduler)) {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}


    // Body (للوضع اليدوي فقط)
    type ManualBody = {
      report_id?: string;           // ✅ دعم report_id المباشر في الوضع اليدوي
      recipient_emails?: string[];
    };
    let bodyJson: ManualBody = {};
    if (!isCron) {
      try {
        const raw = await req.json();
        if (raw && typeof raw === "object") {
          const b = raw as Record<string, unknown>;
          bodyJson = {
            report_id: typeof b.report_id === "string" ? b.report_id : undefined,
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

    // ✅ استخدام الدالة الجاهزة get_report_visits_v4 من قاعدة البيانات
    const buildVisits = async (reportId: string) => {
      const { data, error } = await sb.rpc("get_report_visits_v4", { report_id: reportId });
      if (error) throw error;
      return (data ?? []) as VisitRow[];
    };

    // ======== Resend types + sendEmail (بدون any) ========
    type ResendOk = { id: string };
    type ResendErr = { message?: string; error?: unknown };
    type ResendResp = ResendOk & Partial<ResendErr>;

    const sendEmail = async (to: string, html: string) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // جرّب مؤقتًا from = onboarding@resend.dev
          // وبعد ما توثّق الدومين ارجع لـ MAIL_FROM
          from: MAIL_FROM?.includes("@resend.dev") ? MAIL_FROM : "onboarding@resend.dev",
          to,
          subject: "Daily Report",
          html,
        }),
      });

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        // احتمال مفيش body — تجاهل
      }

      console.log("[RESEND STATUS]", res.status, res.statusText);
      if (json) console.log("[RESEND JSON]", JSON.stringify(json));

      if (!res.ok) {
        const j = json as ResendResp | null;
        const msg = j?.message ?? (j?.error ? String(j.error) : res.statusText || "RESEND_ERROR");
        throw new Error(msg);
      }

      const j = json as ResendResp | null;
      if (!j?.id) {
        throw new Error("Resend did not return an id");
      }

      return { ok: true as const, id: j.id };
    };

    let totalSent = 0;

    if (isCron) {
      // ===== وضع الكرون: نقرأ كل الصفوف المفعّلة ونستدعي الRPC بفلاتر الجدول تلقائيًا =====
      const { data: schedules, error: sErr } = await sb
        .from("scheduled_email_reports")
        .select("id, client_id, recipient_email, filters, is_active")
        .eq("is_active", true);

      if (sErr) throw sErr;
      const list = (schedules ?? []) as ScheduleRow[];

      for (const s of list) {
        const visits = await buildVisits(s.id);
        const html = renderTable(visits, dateY);
        try {
          const r = await sendEmail(s.recipient_email, html);
          console.log("Email OK (cron):", s.recipient_email, r.id);
          totalSent++;
        } catch (err) {
          console.log("Email FAIL (cron):", s.recipient_email, String(err));
        }
      }

      return new Response(JSON.stringify({ ok: true, mode: "cron", sent: totalSent }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // ===== الوضع اليدوي: لو جالنا report_id نستخدمه مباشرة؛ غير كده نبعث لكل المستلمين المفعّلين
    let visits: VisitRow[] = [];
    if (bodyJson.report_id) {
      visits = await buildVisits(bodyJson.report_id);
    } else {
      // default manual: نبعث لنفس قائمة المستلمين المفعّلين (زي الكرون)
      const { data: schedules, error: sErr } = await sb
        .from("scheduled_email_reports")
        .select("id, recipient_email")
        .eq("is_active", true);
      if (sErr) throw sErr;

      // هنجمع HTML واحد لأول report_id (أو فاضي لو مفيش)
      const firstId = schedules?.[0]?.id as string | undefined;
      visits = firstId ? await buildVisits(firstId) : [];
    }

    const html = renderTable(visits, dateY);

    // المستلمين في الوضع اليدوي
    let recipients: string[] = [];
    if (Array.isArray(bodyJson.recipient_emails) && bodyJson.recipient_emails.length > 0) {
      recipients = Array.from(new Set(bodyJson.recipient_emails.map((e) => e.trim()).filter(Boolean)));
    } else {
      const rq = sb
        .from("scheduled_email_reports")
        .select("recipient_email", { distinct: true })
        .eq("is_active", true);
      const { data: rec, error: rErr } = await rq.order("recipient_email", { ascending: true });
      if (rErr) throw rErr;
      recipients = Array.from(
        new Set((rec ?? []).map((r: { recipient_email: string }) => r.recipient_email).filter(Boolean))
      );
    }

    for (const to of recipients) {
      try {
        const r = await sendEmail(to, html);
        console.log("Email OK (manual):", to, r.id);
        totalSent++;
      } catch (err) {
        console.log("Email FAIL (manual):", to, String(err));
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
