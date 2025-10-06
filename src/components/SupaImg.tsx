// src/components/SupaImg.tsx
"use client";

import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type Props = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  bucketHint?: string;
  signingTTL?: number;
  loading?: "eager" | "lazy";
  priority?: boolean;
  /** لو بتستخدم fill يفضل تمرير sizes لتحسين التحميل */
  sizes?: string;
};

/* ===== utils ===== */
const isAbs = (u: string) => /^(https?:|data:|blob:)/i.test(u);

/** جرّد أي URL عام إلى { bucket, key } */
function extractBucketKey(u: string): { bucket: string; key: string } | null {
  try {
    // https://.../storage/v1/object/(public|sign|auth)/<bucket>/<key...>
    const url = new URL(u);
    const i = url.pathname.indexOf("/storage/v1/object/");
    if (i === -1) return null;
    const tail = url.pathname.slice(i + "/storage/v1/object/".length); // public/<bucket>/<key...>
    const parts = tail.split("/").filter(Boolean);
    if (parts.length < 3) return null;
    const bucket = parts[1];
    const key = parts.slice(2).join("/");
    if (!bucket || !key) return null;
    return { bucket, key };
  } catch {
    return null;
  }
}

/** لو الدخل مش URL كامل */
function parseLoosePath(s: string, bucketHint?: string): { bucket: string; key: string } | null {
  const v = (s || "").trim().replace(/^\/+/, "");
  if (!v) return null;

  // bucket/key
  if (v.includes("/")) {
    const [bucket, ...rest] = v.split("/");
    const key = rest.join("/");
    if (bucket && key) return { bucket, key };
  }

  // مجرد اسم ملف + bucketHint
  if (bucketHint) return { bucket: bucketHint, key: v };
  return null;
}

/* ===== component ===== */
export default function SupaImg({
  src,
  alt = "",
  width,
  height,
  style,
  objectFit = "cover",
  bucketHint,
  signingTTL = 60 * 60,
  loading,
  priority,
  sizes,
}: Props) {
  const [signed, setSigned] = useState<string>("");

  const needSign = useMemo(() => {
    if (!src) return false;
    // لو src مطلق (https/data/blob)
    if (isAbs(src)) {
      // لو مطلق لكنه يشير لمسار supabase storage → ممكن يكون Public بس عامل 404، ساعتها نجرّب توقيع
      return !!extractBucketKey(src);
    }
    // أي مسار غير مطلق → نحتاج توقيع
    return true;
  }, [src]);

  useEffect(() => {
  let alive = true;
  async function run() {
    if (!needSign) { setSigned(""); return; }

    const bk = extractBucketKey(src) || parseLoosePath(src, bucketHint);
    if (!bk) { setSigned(""); return; }

    const { data, error } = await supabase.storage.from(bk.bucket).createSignedUrl(bk.key, signingTTL);
    if (!alive) return;

    if (error || !data?.signedUrl) {
      console.warn("[SupaImg] sign FAIL → fallback public", { bucket: bk.bucket, key: bk.key, error });
      const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
      setSigned(`${base}/storage/v1/object/public/${bk.bucket}/${bk.key}`);
      return;
    }

    // لو حابب تتأكد من الـ URL النهائي:
    // console.debug("[SupaImg] signed OK", data.signedUrl);
    setSigned(data.signedUrl);
  }
  run();
  return () => { alive = false; };
}, [src, bucketHint, signingTTL, needSign]);

  // لحد ما الـ signedUrl يجهز، متعرضش <Image /> بـ src فاضي عشان Next بيرفضه
  if (needSign && !signed) {
    return (
      <div
        aria-hidden
        style={{
          width: typeof width === "number" ? width : "100%",
          height: typeof height === "number" ? height : "100%",
          background: "var(--input-bg)",
          borderRadius: 10,
          ...style,
        }}
      />
    );
  }

  const imgSrc = needSign ? signed : src;

  // props المشتركة
  const common = {
    alt: alt || "",
    style: { width: "100%", height: "100%", objectFit, ...style },
    src: imgSrc,
    loading,
    priority,
  } as const;

  if (typeof width === "number" && typeof height === "number") {
    return (
      <Image
        {...common}
        alt={alt || ""}           // <<< مهم: alt صريح
        width={width}
        height={height}
      />
    );
  }

  return (
    <Image
      {...common}
      alt={alt || ""}             // <<< مهم: alt صريح
      fill
      sizes={sizes || "100vw"}
    />
  );
}
