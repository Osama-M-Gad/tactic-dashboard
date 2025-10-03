"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

/** الأدوار المسموحة */
export type Role = "admin" | "super_admin";

/** أقل شكل نحتاجه من المستخدم المحلي */
type StoredUser = {
  id?: string;
  role?: Role | string;  // ممكن تكون نص خام فنطبّعه تحت
  username?: string;
  email?: string;
  auth_user_id?: string;
};

/** قيم حالات الرفض */
type DeniedReason = "no-session" | "no-user" | "forbidden" | "unknown" | null;

/** Parse JSON آمن من التخزين المحلي بدون any */
function parseStoredUser(json: string | null): StoredUser | null {
  if (!json) return null;
  try {
    const obj: unknown = JSON.parse(json);
    if (obj && typeof obj === "object") return obj as StoredUser;
    return null;
  } catch {
    return null;
  }
}

/** قراءة currentUser من local/sessionStorage بدون any */
function getStoredUser(): StoredUser | null {
  try {
    const ls = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
    if (ls) return parseStoredUser(ls);
    const ss = typeof window !== "undefined" ? sessionStorage.getItem("currentUser") : null;
    if (ss) return parseStoredUser(ss);
  } catch {
    /* no-op */
  }
  return null;
}

/**
 * useAuthGuard
 * يتحقق من وجود جلسة Supabase ودور المستخدم قبل عرض الصفحة.
 * يعيد ready=true فقط عندما يكون المرور مسموح.
 */
export function useAuthGuard(allowed: Role[] = ["admin", "super_admin"]) {
  const router = useRouter();
  const ran = useRef(false);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState<DeniedReason>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        // 1) جلسة Supabase لازمة
        const { data, error } = await supabase.auth.getSession();
        const sessionExists = !!data?.session && !error;
        if (!sessionExists) {
          setDenied("no-session");
          router.replace("/login");
          return;
        }

        // 2) مستخدم مخزَّن محليًا (للتحقق من الدور)
        const stored = getStoredUser();
        const roleRaw = (stored?.role ?? "").toString().toLowerCase();
        const role = (roleRaw === "admin" || roleRaw === "super_admin") ? (roleRaw as Role) : null;

        if (!role) {
          setDenied("no-user");
          router.replace("/login");
          return;
        }

        // 3) السماح حسب allowed
        if (!allowed.includes(role)) {
          setDenied("forbidden");
          router.replace("/no-access");
          return;
        }

        setReady(true);
      } catch {
        setDenied("unknown");
        router.replace("/login");
      }
    })();
  }, [router, allowed]);

  return { ready, denied };
}
