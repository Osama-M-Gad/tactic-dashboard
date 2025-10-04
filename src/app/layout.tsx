// app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import GlobalHeader from "@/components/GlobalHeader"; 
import ResponsiveContainer from "@/components/ResponsiveContainer";

/* ===== Local Geist fonts (Arabic + base fallback) ===== */
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

/* ===== Modern English font (Google) ===== */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-en",
});

export const metadata: Metadata = {
  title: "Tactic Portal",
  description: "Tactic & Creativity Portal",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* يطبّق اللغة/الثيم قبل الـ hydration لتفادي أي mismatch */}
        <Script id="boot-lang-theme" strategy="beforeInteractive">
          {`
            try {
              var lsLang = localStorage.getItem("lang");
              var isAr = (lsLang === "ar");
              document.documentElement.dir = isAr ? "rtl" : "ltr";
              document.documentElement.lang = isAr ? "ar" : "en";

              var lsTheme = localStorage.getItem("theme");
              var theme = lsTheme || "dark";
              document.documentElement.setAttribute("data-theme", theme);
            } catch (_) {}
          `}
        </Script>
      </head>

      <body
  className={`
    ${geistSans.variable}
    ${geistMono.variable}
    ${jakarta.variable}
    antialiased
  `}
>
  <ToastProvider>
    <GlobalHeader />
    <ResponsiveContainer>
      <main>{children}</main>
    </ResponsiveContainer>
  </ToastProvider>
</body>
    </html>
  );
}
