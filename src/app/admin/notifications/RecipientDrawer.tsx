"use client";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { useLangTheme } from "@/hooks/useLangTheme";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/* ========== Types ========== */
type NotiRow = {
  id: string;
  title_ar: string | null;
  title_en: string | null;
  message_ar: string | null;
  message_en: string | null;

  team_leader: string | null; // sender
  for_all: boolean | null;
  for_roles: string[] | null;
  for_user: string[] | null;
  for_user_single: string | null;
  completed_by: string[] | null;

  created_at?: string | null;
  completed_at?: string | null;
};

type UserMini = {
  id: string;
  username: string | null;
  name: string | null;          // ← جديد
  arabic_name: string | null;
  role: string | null;
};

/* ========== Utils ========== */
function fmtDateTime(v?: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

const roleLabel = (raw?: string | null, ar = false) => {
  if (!raw) return "-";
  const s = raw.toLowerCase();
  if (["promoter", "promoplus"].includes(s)) return ar ? "مروج" : "Promoter";
  if (["team_leader", "team leader", "teamleader"].includes(s)) return ar ? "قائد فريق" : "Team Leader";
  if (["mch", "merchandiser"].includes(s)) return ar ? "منسق" : "Merchandiser";
  if (["admin", "super_admin", "super admin"].includes(s)) return ar ? "مسؤول" : "Admin";
  return raw;
};

export default function RecipientDrawer({
  open,
  onClose,
  notification,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  notification: NotiRow;
  clientId: string | null;
}) {
  const { isArabic } = useLangTheme();

  const [sender, setSender] = useState<UserMini | null>(null);
  const [recipients, setRecipients] = useState<UserMini[]>([]);

  const completedSet = useMemo(
    () => new Set((notification.completed_by ?? []).map(String)),
    [notification.completed_by]
  );

  /* ===== Load sender + recipients ===== */
  useEffect(() => {
    if (!open) return;

    (async () => {
      // Sender
      if (notification.team_leader) {
        const { data } = await supabase
          .from("Users")
          .select("id,username,name,arabic_name,role")
          .eq("id", notification.team_leader)
          .single();
        if (data) setSender(data as UserMini);
      } else {
        setSender(null);
      }

      // Recipients
      let ids: string[] = [];
      if (notification.for_user_single) ids.push(String(notification.for_user_single));
      if (notification.for_user && notification.for_user.length > 0) {
        ids.push(...notification.for_user.map(String));
      }

      // by roles
      if (ids.length === 0 && notification.for_roles && notification.for_roles.length > 0) {
        const { data: usersByRole } = await supabase
          .from("Users")
          .select("id,username,name,arabic_name,role")
          .in("role", notification.for_roles as string[]);
        let list: UserMini[] = (usersByRole as UserMini[]) || [];

        if (clientId) {
          const { data: map } = await supabase
            .from("client_users")
            .select("user_id")
            .eq("client_id", clientId)
            .eq("is_active", true);
          const allow = new Set((map ?? []).map((r: { user_id: string }) => String(r.user_id)));
          list = list.filter((u) => allow.has(String(u.id)));
        }
        setRecipients(list);
        return;
      }

      // for all
      if (ids.length === 0 && notification.for_all) {
        const { data: all } = await supabase
          .from("Users")
          .select("id,username,name,arabic_name,role");

        let listAll: UserMini[] = (all as UserMini[]) || [];
        if (clientId) {
          const { data: map } = await supabase
            .from("client_users")
            .select("user_id")
            .eq("client_id", clientId)
            .eq("is_active", true);
          const allow = new Set((map ?? []).map((r: { user_id: string }) => String(r.user_id)));
          listAll = listAll.filter((u) => allow.has(String(u.id)));
        }
        setRecipients(listAll);
        return;
      }

      // explicit ids
      ids = Array.from(new Set(ids));
      if (ids.length > 0) {
        const { data } = await supabase
          .from("Users")
          .select("id,username,name,arabic_name,role")
          .in("id", ids);
        setRecipients(
          ((data as UserMini[]) || []).sort((a, b) =>
            String(a.username || a.arabic_name || a.id).localeCompare(
              String(b.username || b.arabic_name || b.id)
            )
          )
        );
      } else {
        setRecipients([]);
      }
    })();
  }, [open, notification, clientId]);

  const colTitle = useMemo(() => (isArabic ? "اسم المستخدم" : "Username"), [isArabic]);

  const name = (u?: UserMini | null) =>
  !u
    ? "-"
    : isArabic
    ? u.arabic_name || u.name || u.username || "-"
    : u.name || u.username || u.arabic_name || "-";

  if (!open) return null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
            {notification.title_en || notification.title_ar || "-"}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {notification.message_en || notification.message_ar || ""}
          </div>
        </div>

        {/* جدول */}
        <div style={card}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={th}>{colTitle}</th>
                <th style={th}>{isArabic ? "الدور" : "Role"}</th>
                <th style={th}>{isArabic ? "المرسل" : "Sender"}</th>
                <th style={th}>{isArabic ? "دور المرسل" : "Sender Role"}</th>
                <th style={th}>{isArabic ? "أُرسلت في" : "Sent at"}</th>
                <th style={th}>{isArabic ? "أُكمِلت في" : "Completed at"}</th>
                <th style={th}>{isArabic ? "مكتمل" : "Completed"}</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={7} style={td}>—</td>
                </tr>
              ) : (
                recipients.map((u) => {
                  const isCompleted = completedSet.has(String(u.id));
                  return (
                    <tr key={u.id}>
                      <td style={td}>{name(u)}</td>
                      <td style={td}>{roleLabel(u.role, isArabic)}</td>
                      <td style={td}>{name(sender)}</td>
                      <td style={td}>{roleLabel(sender?.role, isArabic)}</td>
                      <td style={td}>{fmtDateTime(notification.created_at)}</td>
                      <td style={td}>{isCompleted ? fmtDateTime(notification.completed_at) : "—"}</td>
                      <td style={{ ...td, fontWeight: 800, textAlign: "center" }}>
                        {isCompleted ? "✓" : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Messages EN/AR */}
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ marginBottom: 8, textAlign: "left" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>
              {notification.title_en || (isArabic ? "العنوان (EN)" : "Title (EN)")}
            </div>
            <div style={{ color: "var(--muted)" }}>
              {notification.message_en || "—"}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>
              {notification.title_ar || (isArabic ? "العنوان (AR)" : "Title (AR)")}
            </div>
            <div style={{ color: "var(--muted)" }}>
              {notification.message_ar || "—"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onClose} style={btnPrimary}>{isArabic ? "إغلاق" : "Close"}</button>
        </div>
      </div>
    </div>
  );
}

/* ========== Styles ========== */
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const sheet: React.CSSProperties = {
  width: "min(900px, 92vw)",
  background: "var(--card)",
  color: "var(--text)",
  border: "1px solid var(--divider)",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,.35)",
};

const card: React.CSSProperties = {
  border: "1px solid var(--divider)",
  borderRadius: 12,
  padding: 12,
  background: "color-mix(in oklab, var(--card) 92%, transparent)",
};

const th: React.CSSProperties = {
  textAlign: "start",
  padding: "10px 10px",
  borderBottom: "1px solid var(--divider)",
  fontSize: 13,
};

const td: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid var(--divider)",
  fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};
