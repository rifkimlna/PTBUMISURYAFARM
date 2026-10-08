import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// pg-connection-string v2.14+ treats sslmode=require as alias for
// verify-full and prints a SECURITY WARNING on every new Pool.
// Normalize to verify-full (same strict behavior, no warning) so
// old Vercel/Neon env vars with sslmode=require don't spam logs.
export function normalizeConnectionString(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.includes("uselibpqcompat=")) return url;
  // Only replace exact sslmode=require / prefer / verify-ca, not verify-full
  let out = url
    .replace(/([?&])sslmode=require\b/g, "$1sslmode=verify-full")
    .replace(/([?&])sslmode=prefer\b/g, "$1sslmode=verify-full")
    .replace(/([?&])sslmode=verify-ca\b/g, "$1sslmode=verify-full");
  // Neon pooler di serverless (Vercel): pastikan ada connect_timeout agar
  // gagal-cepat, bukan hang. Jangan paksa pgbouncer=true di sini karena
  // @prisma/adapter-pg memakai pg Pool langsung (bukan engine Prisma),
  // dan string lokal yang sudah terbukti jalan tidak boleh diubah perilakunya.
  // Hanya tambah default bila belum ada param timeout sama sekali.
  if (!/[?&]connect_timeout=/.test(out)) {
    out += (out.includes("?") ? "&" : "?") + "connect_timeout=15";
  }
  return out;
}

// Deteksi error koneksi DB (P1001 "Can't reach database server" dkk)
// agar API bisa balas 503 ramah, bukan bocorkan stack Prisma (500).
export function isDbConnectionError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null | undefined)?.code;
  if (code === "P1001" || code === "P1002" || code === "P1008" || code === "P1017") return true;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /can't reach database server|database.*tidak terhubung|database_url.*belum diisi|connection\s*(terminated|refused|timed out|timeout)|connect_timeout|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout expired|server closed the connection|pgbouncer|channel_binding/i.test(msg);
}

export function dbUnreachableMessage(): string {
  if (!process.env.DATABASE_URL) {
    return "Database tidak terhubung (DATABASE_URL belum diisi). Isi di Vercel Project Settings → Environment Variables lalu redeploy.";
  }
  return "Database tidak terhubung. Cek DATABASE_URL di Vercel (Project Settings → Environment Variables) lalu redeploy. Jika Neon habis pause, buka console.neon.tech lalu resume project.";
}

const connectionString = normalizeConnectionString(process.env.DATABASE_URL);

if (!connectionString) {
  // Jangan diam-diam pakai localhost: di Vercel .env tidak ikut deploy,
  // jadi DATABASE_URL wajib diisi di Project Settings → Environment Variables.
  console.error("[prisma] DATABASE_URL belum diisi. Isi di Vercel Environment Variables lalu redeploy.");
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Sengaja tidak throw di sini: modul ini di-import saat build/collect,
  // dan query yang gagal akan ditangkap try/catch di page/API dengan
  // pesan yang jelas. Throw di level import justru menembus try/catch.
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;