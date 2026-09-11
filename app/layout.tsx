import type { Metadata, Viewport } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PT BUMI SURYA FARM - Perkebunan",
  description: "Sistem Manajemen Perkebunan PT BUMI SURYA FARM (pt_bst)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#15803d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${poppins.variable} ${jetbrainsMono.variable} h-full antialiased scroll-smooth`}>
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden bg-[#FCFCFD] text-slate-900">{children}</body>
    </html>
  );
}
