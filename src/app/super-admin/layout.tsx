"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? (localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser")) : null;
      const user = raw ? JSON.parse(raw) : null;
      const role = String(user?.role || "").toLowerCase();
      if (role !== "super_admin") {
        if (!redirected.current) { redirected.current = true; router.replace(role === "admin" ? "/admin/dashboard" : "/no-access"); }
        return;
      }
    } catch {
      if (!redirected.current) { redirected.current = true; router.replace("/no-access"); }
      return;
    } finally { setReady(true); }
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
