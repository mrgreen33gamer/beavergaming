import type { Metadata } from "next";
import { Geist, Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

// preload:false — the fonts are still self-hosted and load on first use, but we
// drop the <link rel="preload"> tags. On heavy routes (the 3D game), the JS
// bundle delays first paint past the browser's preload-usage window, which
// otherwise logs "preloaded resource was not used within a few seconds". The
// trade is a possible brief font-swap on fast pages; `display: swap` keeps text
// visible with a fallback until the pixel face loads.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Beaver Gaming — Free Online Games",
  description:
    "A pile of simple, addictive browser games. No downloads, no install — just play instantly in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${pressStart.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
