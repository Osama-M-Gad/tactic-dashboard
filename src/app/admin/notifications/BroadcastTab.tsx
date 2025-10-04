"use client";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useLangTheme } from "@/hooks/useLangTheme";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/* ========= Types ========= */
type UserMini = {
  id: string;
  username: string | null;
  name: string | null;          // ← جديد
  arabic_name: string | null;
  role: string | null;
};

type InsertNotification = {
  client_id: string | null;
  title_ar: string | null;
  title_en: string | null;
  message_ar: string | null;
  message_en: string | null;
  team_leader: string | null;      // ← المرسل
  for_all: boolean;
  for_roles: string[] | null;
  for_user: string[] | null;
  for_user_single: string | null;
  status: string | null;
};

/* ========= Roles (UI) ========= */
type RoleKey = "ALL_ROLES" | "PROMOTER" | "MERCHANDISER" | "TEAM_LEADER" | "ALL_USERS";

const ROLE_OPTIONS: { key: RoleKey; en: string; ar: string }[] = [
  { key: "ALL_ROLES", en: "All roles", ar: "كل الأدوار" },
  { key: "PROMOTER", en: "Promoter", ar: "مروج" },
  { key: "TEAM_LEADER", en: "Team Leader", ar: "قائد فريق" },
  { key: "MERCHANDISER", en: "Merchandiser", ar: "منسق" },
  { key: "ALL_USERS", en: "All users (this client)", ar: "كل المستخدمين (هذا العميل)" },
];

/* ========= Role → DB patterns (case-insensitive) ========= */
const ROLE_PATTERNS: Record<RoleKey, string[]> = {
  ALL_ROLES: [],
  ALL_USERS: [],
  PROMOTER: ["promoter", "promoplus"],
  MERCHANDISER: ["mch", "merchandiser"],
  TEAM_LEADER: ["team_leader", "team leader"],
};

/* ========= Helpers ========= */
const roleLabel = (raw?: string | null, ar = false) => {
  if (!raw) return "-";
  const s = raw.toLowerCase();
  if (["promoter", "promoplus"].includes(s)) return ar ? "مروج" : "Promoter";
  if (["team_leader", "team leader", "teamleader"].includes(s)) return ar ? "قائد فريق" : "Team Leader";
  if (["mch", "merchandiser"].includes(s)) return ar ? "منسق" : "Merchandiser";
  if (["admin", "super_admin", "super admin"].includes(s)) return ar ? "مسؤول" : "Admin";
  return raw;
};

/* ============ MultiSelect (بحث + اختيارات) ============ */
function useOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onOutside]);
  return ref;
}

function MultiSelect({
  label,
  options,
  values,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useOutside(() => setOpen(false));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [q, options]);

  const summary =
    values.length === 0
      ? "—"
      : values.length === 1
      ? options.find((o) => o.value === values[0])?.label || "—"
      : `${values.length} selected`;

  const toggle = (v: string) => {
    const set = new Set(values);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    onChange(Array.from(set));
  };

  return (
    <div className="ms-wrap" ref={wrapRef} style={{ opacity: disabled ? 0.6 : 1 }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{label}</div>

      <button
        type="button"
        className="ms-btn"
        onClick={() => !disabled && setOpen((s) => !s)}
        disabled={disabled}
      >
        <span>{summary}</span>
        <span style={{ marginInlineStart: "auto", opacity: 0.8 }}>▾</span>
      </button>

      {open && !disabled && (
        <div className="ms-panel">
          <input
            className="ms-search"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="ms-list">
            {filtered.length === 0 ? (
              <div className="ms-empty">No results</div>
            ) : (
              filtered.map((o) => (
                <label className="ms-opt" key={o.value} title={o.label}>
                  <input
                    type="checkbox"
                    checked={values.includes(o.value)}
                    onChange={() => toggle(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Component ================= */
export default function BroadcastTab({ clientId }: { clientId: string | null }) {
  const { isArabic } = useLangTheme();

  // عناوين ونصوص
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [msgAr, setMsgAr] = useState("");
  const [msgEn, setMsgEn] = useState("");

  // أدوار ومستخدمون
  const [roles, setRoles] = useState<RoleKey[]>([]);
  const [users, setUsers] = useState<UserMini[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // ===== مشتقات
  type RoleKeyNoAll = Exclude<RoleKey, "ALL_USERS" | "ALL_ROLES">;
  const rolesHasAllUsers = useMemo(() => roles.includes("ALL_USERS"), [roles]);
  const rolesHasAllRoles = useMemo(() => roles.includes("ALL_ROLES"), [roles]);

  const chosenRoles = useMemo(
    () => roles.filter((r): r is RoleKeyNoAll => r !== "ALL_USERS" && r !== "ALL_ROLES"),
    [roles]
  );

  const ilikeOrClause = useMemo(() => {
    if (rolesHasAllRoles || chosenRoles.length === 0) return null;
    const parts: string[] = [];
    for (const rk of chosenRoles) {
      const pats = ROLE_PATTERNS[rk] || [];
      for (const p of pats) parts.push(`role.ilike.*${p}*`);
    }
    return parts.length ? parts.join(",") : null;
  }, [rolesHasAllRoles, chosenRoles]);

  const displayName = (u: UserMini) =>
  isArabic
    ? u.arabic_name || u.name || u.username || "-"
    : u.name || u.username || u.arabic_name || "-";


  /* ====== Load users لهذا العميل + حسب الأدوار ====== */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!clientId || rolesHasAllUsers) {
        if (!cancelled) {
          setUsers([]);
          setSelectedUsers([]);
        }
        return;
      }

      const { data: map, error: mapErr } = await supabase
        .from("client_users")
        .select("user_id")
        .eq("client_id", clientId)
        .eq("is_active", true);

      if (mapErr || !map || map.length === 0) {
        if (!cancelled) {
          setUsers([]);
          setSelectedUsers([]);
        }
        return;
      }

      const ids = Array.from(new Set(map.map((r: { user_id: string }) => String(r.user_id))));
      let q = supabase.from("Users").select("id,username,arabic_name,role").in("id", ids);

      if (ilikeOrClause) q = q.or(ilikeOrClause);

      const { data: list, error: usersErr } = await q;
      if (usersErr) {
        if (!cancelled) {
          setUsers([]);
          setSelectedUsers([]);
        }
        return;
      }

      const sorted = ((list as UserMini[]) || []).sort((a, b) =>
        String(a.username || a.arabic_name || a.id).localeCompare(
          String(b.username || b.arabic_name || b.id)
        )
      );

      if (!cancelled) {
        setUsers(sorted);
        setSelectedUsers([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, rolesHasAllUsers, ilikeOrClause]);

  /* ====== Submit ====== */
  const canSubmit = useMemo(() => {
    const hasTitle = Boolean(titleAr.trim() || titleEn.trim());
    const hasBody = Boolean(msgAr.trim() || msgEn.trim());
    const targetingOK =
      rolesHasAllUsers || rolesHasAllRoles || chosenRoles.length > 0 || selectedUsers.length > 0;
    return hasTitle && hasBody && targetingOK && !submitting;
  }, [
    titleAr,
    titleEn,
    msgAr,
    msgEn,
    rolesHasAllUsers,
    rolesHasAllRoles,
    chosenRoles.length,
    selectedUsers.length,
    submitting,
  ]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setToast(null);

    const for_all = rolesHasAllUsers;

    const sendableRoles =
      !for_all && !rolesHasAllRoles && chosenRoles.length > 0
        ? chosenRoles.map((r) =>
            r === "PROMOTER" ? "Promoter" : r === "TEAM_LEADER" ? "TeamLeader" : "Merchandiser"
          )
        : null;

    const sendUsers = !for_all && selectedUsers.length > 0 ? Array.from(new Set(selectedUsers)) : null;

    // 🔐 تحديد المرسل = Users.id من auth
    const { data: authObj } = await supabase.auth.getUser();
    let senderId: string | null = null;
    if (authObj?.user?.id) {
      const { data: urow } = await supabase
        .from("Users")
        .select("id")
        .eq("auth_user_id", authObj.user.id)
        .single();
      senderId = urow?.id ?? null;
    }

    const payload: InsertNotification = {
      client_id: clientId ?? null,
      title_ar: titleAr.trim() || null,
      title_en: titleEn.trim() || null,
      message_ar: msgAr.trim() || null,
      message_en: msgEn.trim() || null,
      team_leader: senderId, // ← المهم
      for_all,
      for_roles: sendableRoles,
      for_user: sendUsers,
      for_user_single: null,
      status: "NEW",
    };

    const { error } = await supabase.from("Notifications").insert(payload);
    if (error) {
      setToast({ kind: "error", text: isArabic ? "فشل الإرسال" : "Send failed" });
      setSubmitting(false);
      return;
    }

    setToast({ kind: "success", text: isArabic ? "تم الإرسال" : "Sent" });
    setTitleAr("");
    setTitleEn("");
    setMsgAr("");
    setMsgEn("");
    setRoles([]);
    setUsers([]);
    setSelectedUsers([]);
    setSubmitting(false);
  };

  /* ====== UI ====== */
  const roleUiOptions = ROLE_OPTIONS.map((r) => ({
    value: r.key,
    label: isArabic ? r.ar : r.en,
  }));

  // مستخدمون → MultiSelect (مع ترجمة الدور)
  const userUiOptions = users.map((u) => ({
    value: u.id,
    label: `${displayName(u)}${u.role ? ` • ${roleLabel(u.role, isArabic)}` : ""}`,
  }));

  return (
    <form onSubmit={onSubmit} className="broadcast-form">
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <Cap label={isArabic ? "(AR) العنوان" : "(AR) Title"}>
          <input
            className="force-rtl"
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
            placeholder={isArabic ? "عنوان بالعربية" : "Title in Arabic"}
          />
        </Cap>

        <div style={{ height: 8 }} />
        <Cap label={isArabic ? "(EN) العنوان" : "(EN) Title"}>
          <input
            className="force-ltr"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            placeholder="Title in English"
          />
        </Cap>

        <div style={{ height: 8 }} />
        <Cap label={isArabic ? "(AR) النص" : "(AR) Message"}>
          <textarea
            rows={5}
            className="force-rtl"
            value={msgAr}
            onChange={(e) => setMsgAr(e.target.value)}
            placeholder={isArabic ? "النص بالعربية" : "Arabic message"}
          />
        </Cap>

        <div style={{ height: 8 }} />
        <Cap label={isArabic ? "(EN) النص" : "(EN) Message"}>
          <textarea
            rows={5}
            className="force-ltr"
            value={msgEn}
            onChange={(e) => setMsgEn(e.target.value)}
            placeholder="Message in English"
          />
        </Cap>

        <div style={{ height: 12 }} />
        <MultiSelect
          label={isArabic ? "الأدوار المستهدفة" : "Target roles"}
          options={roleUiOptions}
          values={roles}
          onChange={(v) => {
            setRoles(v as RoleKey[]);
            if ((v as RoleKey[]).includes("ALL_USERS")) setSelectedUsers([]);
          }}
        />

        <div style={{ height: 8 }} />
        <MultiSelect
          label={isArabic ? "المستخدمون" : "Users"}
          options={userUiOptions}
          values={selectedUsers}
          onChange={setSelectedUsers}
          disabled={rolesHasAllUsers}
        />

        <div style={{ height: 12 }} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" disabled={!canSubmit} style={btnPrimary}>
            {submitting ? (isArabic ? "جارٍ الإرسال…" : "Sending…") : isArabic ? "إرسال" : "Send"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="toast-wrap">
          <div className={`toast ${toast.kind === "success" ? "success" : "error"}`}>
            <span className="dot" />
            {toast.text}
          </div>
        </div>
      )}
    </form>
  );
}

/* ============ Small UI helpers ============ */
function Cap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--divider)",
        borderRadius: 12,
        padding: 10,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      {children}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

/* ===== Minimal styles for MultiSelect ===== */
const _style = `
.ms-wrap { position: relative; }
.ms-btn {
  width: 100%; background: var(--card); color: var(--text);
  border: 1px solid var(--divider); border-radius: 10px;
  padding: 10px 12px; display: inline-flex; align-items: center; gap: 8px;
}
.ms-panel {
  position: absolute; inset-inline-start: 0; top: calc(100% + 6px);
  z-index: 50; min-width: 280px; max-height: 300px; overflow: hidden;
  background: var(--card); border: 1px solid var(--divider); border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,.35);
}
.ms-search {
  width: 100%; padding: 10px 12px; border: 0; border-bottom: 1px solid var(--divider);
  background: color-mix(in oklab, var(--card) 92%, transparent); color: var(--text);
  outline: none;
}
.ms-list { max-height: 240px; overflow: auto; }
.ms-opt {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer;
  border-bottom: 1px solid color-mix(in oklab, var(--divider) 60%, transparent);
}
.ms-opt:last-child { border-bottom: 0; }
.ms-opt:hover { background: color-mix(in oklab, var(--card) 88%, transparent); }
.ms-empty { padding: 12px; opacity: .75; }
`;
if (typeof window !== "undefined") {
  const id = "ms-inline-style";
  if (!document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.innerHTML = _style;
    document.head.appendChild(el);
  }
}
