// app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import GlobalHeader from "../components/GlobalHeader";

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

export const metadata: Metadata = {
  title: "Tactic Portal",
  description: "Tactic & Creativity Portal",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // SSR يبدأ EN/Dark؛ هنطبّق المخزّن قبل الـ hydration
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* طبّق اللغة والثيم من localStorage قبل أي رندر */}
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

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <GlobalHeader />
        {/* الهيدر sticky؛ مفيش padding-top */}
        <main>{children}</main>
      </body>
    </html>
  );
}
