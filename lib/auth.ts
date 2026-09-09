import bcrypt from "bcryptjs";
import * as jose from "jose";
import type { NextRequest } from "next/server";

// Secret - fallback untuk dev, wajib diisi di production
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-pt-bst-please-change-in-production-32chars!";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const secret = new TextEncoder().encode(JWT_SECRET);

export type Role = "SUPER_ADMIN" | "ADMIN_PERTANIAN" | "ADMIN_KEUANGAN";

export interface JWTPayload {
  userId: string;
  email: string;
  nama: string;
  role: Role;
}

// ========== Password Helpers ==========
const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

// ========== JWT Helpers (jose - Edge compatible) ==========
export async function signToken(payload: JWTPayload): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .setSubject(payload.userId)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return {
      userId: payload.userId as string ?? payload.sub as string,
      email: payload.email as string,
      nama: payload.nama as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

// ========== Request Helpers ==========
export function extractTokenFromRequest(req: Request | NextRequest): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // 2. Cookie: token=...
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, decodeURIComponent(v.join("="))];
      })
    );
    if (cookies.token) return cookies.token;
    if (cookies["auth-token"]) return cookies["auth-token"];
  }

  return null;
}

export async function getSessionFromRequest(req: Request | NextRequest): Promise<JWTPayload | null> {
  const token = extractTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Guard untuk API Route - cek auth + role
 * Contoh:
 *   const session = await requireAuth(req);
 *   if (session instanceof Response) return session;
 *   const allowed = requireRole(session, ["SUPER_ADMIN", "ADMIN_PERTANIAN"]);
 */
export async function requireAuth(req: Request | NextRequest): Promise<JWTPayload | Response> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return Response.json(
      { success: false, message: "Unauthorized - token tidak valid atau belum login" },
      { status: 401 }
    );
  }
  return session;
}

export function requireRole(
  session: JWTPayload,
  allowedRoles: Role[]
): JWTPayload | Response {
  if (!allowedRoles.includes(session.role)) {
    return Response.json(
      {
        success: false,
        message: `Forbidden - role ${session.role} tidak diizinkan. Butuh: ${allowedRoles.join(", ")}`,
      },
      { status: 403 }
    );
  }
  return session;
}

/**
 * Kombinasi cek auth + role dalam satu call
 */
export async function requireAuthAndRole(
  req: Request | NextRequest,
  allowedRoles: Role[]
): Promise<JWTPayload | Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const roleCheck = requireRole(auth, allowedRoles);
  if (roleCheck instanceof Response) return roleCheck;
  return auth;
}
