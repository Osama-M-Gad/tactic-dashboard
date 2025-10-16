"use client";

import { useEffect, useState } from "react";

/** هوك عالمي: يقرأ اللغة والثيم من <html> / localStorage بعد mount فقط
 * يبدأ EN/Dark لتفادي أي hydration mismatch
 */
export function useLangTheme() {
  const [isArabic, setIsArabic] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;

    const syncNow = () => {
      const langLS = localStorage.getItem("lang");
      const themeAttr = el.getAttribute("data-theme");
      const themeLS = localStorage.getItem("theme");

      setIsArabic(el.dir === "rtl" || langLS === "ar");

      // ✅ دايمًا نبدأ dark لو مفيش حاجة محفوظة أو حصل mismatch
      const t = themeAttr || themeLS || "dark";
      if (t !== "dark" && t !== "light") {
        localStorage.setItem("theme", "dark");
        el.setAttribute("data-theme", "dark");
        setIsDark(true);
        return;
      }

      setIsDark(t === "dark");
    };

    syncNow();

    const mo = new MutationObserver(syncNow);
    mo.observe(el, { attributes: true, attributeFilter: ["dir", "data-theme"] });

    const onStorage = (e: StorageEvent) => {
      if (e.key === "lang" || e.key === "theme") syncNow();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mo.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { isArabic, isDark };
}
