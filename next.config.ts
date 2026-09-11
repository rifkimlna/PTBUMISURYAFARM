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
