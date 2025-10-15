// src/components/SupaImg.tsx
"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/* ===== utils ===== */
const isAbs = (u: string) => /^(https?:|data:|blob:)/i.test(u);

/** جرّد أي URL عام إلى { bucket, key } */
function extractBucketKey(u: string): { bucket: string; key: string } | null {
  try {
    // https://.../storage/v1/object/(public|sign|auth)/<bucket>/<key...>
    const url = new URL(u);
    const i = url.pathname.indexOf("/storage/v1/object/");
    if (i === -1) return null;
    const tail = url.pathname.slice(i + "/storage/v1/object/".length);
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
function parseLoosePath(
  s: string,
  bucketHint?: string
): { bucket: string; key: string } | null {
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

/** ===== props ===== */
type Props = Omit<ImageProps, "src"> & {
  src: string;
  bucketHint?: string;
  signingTTL?: number;
  /** للراحة: نجمع objectFit داخل style */
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
};

export default function SupaImg({
  src,
  bucketHint,
  signingTTL = 60 * 60,
  objectFit = "cover",
  style,
  alt = "",
  ...imgProps
}: Props) {
  const [signed, setSigned] = useState<string>("");

  const needSign = useMemo(() => {
    if (!src) return false;
    if (isAbs(src)) {
      // مطلق لكنه يشير لمسار supabase storage → قد يحتاج توقيع
      return !!extractBucketKey(src);
    }
    // أي مسار غير مطلق → نحتاج توقيع
    return true;
  }, [src]);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!needSign) {
        setSigned("");
        return;
      }

      const bk = extractBucketKey(src) || parseLoosePath(src, bucketHint);
      if (!bk) {
        setSigned("");
        return;
      }

      const { data, error } = await supabase.storage
        .from(bk.bucket)
        .createSignedUrl(bk.key, signingTTL);

      if (!alive) return;

      if (error || !data?.signedUrl) {
        console.warn("[SupaImg] sign FAIL → fallback public", {
          bucket: bk.bucket,
          key: bk.key,
          error,
        });
        const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
        setSigned(`${base}/storage/v1/object/public/${bk.bucket}/${bk.key}`);
        return;
      }

      setSigned(data.signedUrl);
    }
    run();
    return () => {
      alive = false;
    };
  }, [src, bucketHint, signingTTL, needSign]);

  // نفكك width/height/sizes من ImageProps عشان نستخدمهم بدون any
  const { width, height, sizes, ...restProps } = imgProps;

  // placeholder لحد ما نجيب signedUrl
  if (needSign && !signed) {
    const wCss =
      typeof width === "number"
        ? width
        : (style as React.CSSProperties | undefined)?.width ?? "100%";
    const hCss =
      typeof height === "number"
        ? height
        : (style as React.CSSProperties | undefined)?.height ?? "100%";

    return (
      <div
        aria-hidden
        style={{
          width: wCss as number | string,
          height: hCss as number | string,
          background: "var(--input-bg)",
          borderRadius: 10,
          ...(style as React.CSSProperties),
        }}
      />
    );
  }

  const imgSrc = needSign ? signed : src;
  const mergedStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit,
    ...(style as React.CSSProperties),
  };

  // لو عندك width/height → نستخدمهما
  if (typeof width === "number" && typeof height === "number") {
    return (
      <Image
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        style={mergedStyle}
        {...restProps}
      />
    );
  }

  // غير كده → نستخدم fill
  return (
    <Image
      src={imgSrc}
      alt={alt}
      fill
      sizes={sizes ?? "100vw"}
      style={mergedStyle}
      {...restProps}
    />
  );
}
