"use client";
import { getSupabaseClient } from "@/utils/supabaseClient";

/** يقرأ المستخدم ومفتاح الجلسة من التخزين المحلي/المؤقت */
function readStored() {
  const lsUser = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
  const ssUser = typeof window !== "undefined" ? sessionStorage.getItem("currentUser") : null;
  const user = lsUser ? JSON.parse(lsUser) : (ssUser ? JSON.parse(ssUser) : null);

  const lsKey = typeof window !== "undefined" ? localStorage.getItem("session_key") : null;
  const ssKey = typeof window !== "undefined" ? sessionStorage.getItem("session_key") : null;
  const session_key = lsKey ?? ssKey ?? null;

  return { user, session_key };
}

/** يمسح كل آثار الجلسة محليًا */
export function clearStoredSession() {
  try {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("session_key");
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("session_key");
  } catch {}
}

/** تسجيل الخروج: يحدّث user_sessions.logout_at ثم يمسح التخزين ويعيد التوجيه */
export async function logout() {
  const { user, session_key } = readStored();
    try {
      if (user?.id && session_key) {
        const supabase = getSupabaseClient();
        await supabase
          .from("user_sessions")
          .update({ logout_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("session_key", session_key)
          .is("logout_at", null);
      }
    } catch (e) {
    console.warn("logout update failed", e);
  } finally {
    clearStoredSession();
    if (typeof window !== "undefined") window.location.href = "/login";
  }
}
