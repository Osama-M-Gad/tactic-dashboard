"use client";
import { useEffect, useMemo, useState, ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import { useLangTheme } from "@/hooks/useLangTheme";
import TeamNotificationsTab from "./TeamNotificationsTab";
import BroadcastTab from "./BroadcastTab";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function NotificationsPage() {
  const { isArabic } = useLangTheme();
  const router = useRouter();

const goBack = () => {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();                         // رجوع فعلي
  } else {
    router.push("/admin/dashboard");       // ← عدّل ده لمسار الداشبورد الفعلي عندك
  }
};
  const [activeTab, setActiveTab] = useState<"team" | "broadcast">("team");
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // احصل على client_id من v_user_company_profile حسب جلسة الأدمن
  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) return setLoading(false);

      const { data } = await supabase
        .from("v_user_company_profile")
        .select("client_id")
        .eq("auth_user_id", uid)
        .single();

      setClientId((data as { client_id: string } | null)?.client_id ?? null);
      setLoading(false);
    })();
  }, []);

  const title = useMemo(() => (isArabic ? "الإشعارات" : "Notifications"), [isArabic]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 14 }}>
        <div
          style={{
            width: "min(1100px, 94vw)",
            background: "var(--card)",
            border: "1px solid var(--divider)",
            borderRadius: 12,
            padding: 12,
          }}
        >
            <div
  style={{
    display: "flex",
    justifyContent: isArabic ? "flex-start" : "flex-end",
    marginBottom: 8,
  }}
>
  <button
  onClick={goBack}
  style={{
    background: "var(--accent)",
    color: "var(--accent-foreground)",
    border: "1px solid var(--divider)",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  }}
>
  {isArabic ? "← رجوع" : "Back →"}
</button>
</div>
          <h2 style={{ margin: 0 }}>{title}</h2>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <TabBtn active={activeTab === "team"} onClick={() => setActiveTab("team")}>
              {isArabic ? "إشعارات الفريق" : "Team notifications"}
            </TabBtn>
            <TabBtn active={activeTab === "broadcast"} onClick={() => setActiveTab("broadcast")}>
              {isArabic ? "إرسال إشعار" : "Send broadcast"}
            </TabBtn>
          </div>

          <div style={{ marginTop: 16 }}>
            {loading ? (
              <Box>{isArabic ? "جارِ التحميل…" : "Loading…"}</Box>
            ) : activeTab === "team" ? (
              <TeamNotificationsTab clientId={clientId} />
            ) : (
              <BroadcastTab clientId={clientId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Helpers */
function Box({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--divider)",
        background: "var(--bg)",
        borderRadius: 12,
        padding: 14,
      }}
    >
      {children}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "var(--accent)" : "var(--card)",
        color: active ? "var(--accent-foreground)" : "var(--text)",
        border: "1px solid var(--divider)",
        borderRadius: 999,
        padding: "8px 12px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
