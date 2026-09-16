import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// pg-connection-string v2.14+ treats sslmode=require as alias for
// verify-full and prints a SECURITY WARNING on every new Pool.
// Normalize to verify-full (same strict behavior, no warning) so
// old Vercel/Neon env vars with sslmode=require don't spam logs.
function normalizeConnectionString(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.includes("uselibpqcompat=")) return url;
  // Only replace exact sslmode=require / prefer / verify-ca, not verify-full
  return url
    .replace(/([?&])sslmode=require\b/g, "$1sslmode=verify-full")
    .replace(/([?&])sslmode=prefer\b/g, "$1sslmode=verify-full")
    .replace(/([?&])sslmode=verify-ca\b/g, "$1sslmode=verify-full");
}

const connectionString = normalizeConnectionString(process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;