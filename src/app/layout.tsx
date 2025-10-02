import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";


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
  icons: {
    // Change this to point to the local file in the public directory
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* REMOVE THIS <head> BLOCK and its content completely,
          as `metadata` object handles it automatically.
          You typically don't put a <head> tag directly in RootLayout
          when using the App Router's metadata API. */}
      {/* <head>
        <link
          rel="icon"
          href="https://sygnesgnnaoadhrzacmp.supabase.co/storage/v1/object/public/public-files//icon.png"
        />
      </head> */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}