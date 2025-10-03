// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      // الدومين الفعلي لمشروعك على Supabase (بدّله لو مختلف)
      {
        protocol: 'https',
        hostname: 'sygnesgnnaoadhrzacmp.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // اختيارية: السماح لأي مشروع Supabase عام (لو بتسحب من أكتر من مشروع)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // خليه true لو عايز البيلد يفشل عند أخطاء ESLint؛ ممكن تخليه false لو عايز يتجاوزها
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
