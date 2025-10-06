// next.config.mjs
/** @type {import('next').NextConfig} */

// استنتاج الدومين من متغير البيئة لو موجود
const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "sygnesgnnaoadhrzacmp.supabase.co";

const nextConfig = {
  reactStrictMode: true,

  images: {
    // السماح لصور Supabase العامة بالعرض عبر next/image
    remotePatterns: [
      {
        protocol: "https",
        hostname: SUPABASE_HOST,
        pathname: "/storage/v1/object/**",
      },
      // لو عندك أكثر من باكت أو مسارات مختلفة داخل نفس المشروع مفيش مشكلة — الباترن أعلاه يشملها
      // لو هتسحب صور من دومينات أخرى (CDN أو جهات خارجية) ضيفها هنا بنفس الشكل.
    ],
    domains: [SUPABASE_HOST],
  },

  // خليها false لو عايز تتجاوز أخطاء ESLint وقت البيلد
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
