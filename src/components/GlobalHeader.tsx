"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import AppHeader from "./AppHeader";

const LS_LANG = "lang";

export default function GlobalHeader() {
  const pathname = usePathname();

  // ابدأ من الحالة الفعلية فورًا (dir/localStorage) لتفادي الفلاش
  const [isArabic, setIsArabic] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const ls = localStorage.getItem(LS_LANG);
    if (ls === "ar") return true;
    return document.documentElement.dir === "rtl";
  });

  const headerRef = useRef<HTMLDivElement | null>(null);

  // كل ما اللغة تتغيّر، حدّث dir + lang (مكان موحّد)
  useEffect(() => {
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    document.documentElement.lang = isArabic ? "ar" : "en";
  }, [isArabic]);

  // قياس ارتفاع الهيدر إلى --header-h (لو محتاجها)
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onToggleLang = useCallback(() => {
    setIsArabic(prev => {
      const next = !prev;
      try { localStorage.setItem(LS_LANG, next ? "ar" : "en"); } catch {}
      return next;
    });
  }, []);

  const showLogout = pathname !== "/login" && pathname !== "/update-password";

  const wrapStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 50,
    backdropFilter: "saturate(180%) blur(6px)",
  };

  return (
    <div style={wrapStyle} ref={headerRef}>
      <AppHeader
        onToggleLang={onToggleLang}
        showLogout={showLogout}
      />
    </div>
  );
}
