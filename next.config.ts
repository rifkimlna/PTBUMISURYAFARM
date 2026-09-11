import type { NextConfig } from "next";

const nextConfig: NextConfig = {
// Fix ngrok "tidak bisa klik" -> HMR cross-origin blocked kalau via ngrok
  // Next 16: allowedDevOrigins harus include host ngrok, wildcard * di depan didukung
  allowedDevOrigins: [
    "192.168.56.1",
    "localhost",
    "127.0.0.1",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
  async redirects() {
    return [
      // Lapangan di admin sudah dihapus — redirect ke edit (admin full)
      { source: "/perkebunan/pohon/:id/lapangan", destination: "/perkebunan/pohon/:id/edit", permanent: false },
      { source: "/admin/pertanian/pohon/:id/lapangan", destination: "/perkebunan/pohon/:id/edit", permanent: false },
      // Legacy admin -> new split routes
      { source: "/admin/pertanian", destination: "/perkebunan", permanent: false },
      { source: "/admin/pertanian/:path*", destination: "/perkebunan/:path*", permanent: false },
      { source: "/admin/keuangan", destination: "/keuangan/kas", permanent: false },
      { source: "/admin/keuangan/:path*", destination: "/keuangan/:path*", permanent: false },
      { source: "/admin/aset", destination: "/keuangan/aset", permanent: false },
      { source: "/admin/aset/:path*", destination: "/keuangan/aset/:path*", permanent: false },
      { source: "/admin/persediaan", destination: "/keuangan/persediaan", permanent: false },
      { source: "/admin/persediaan/:path*", destination: "/keuangan/persediaan/:path*", permanent: false },
    ];
  },
  // Allow ngrok / tunneling hosts + prevent layout break on external images
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.qrserver.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
};

export default nextConfig;
