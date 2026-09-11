import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

// Path yang tidak perlu auth
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/health",
];

// Prefix yang wajib auth (sesuai spec: /api/admin/*)
const PROTECTED_PREFIXES = ["/api/admin", "/api/pohon", "/api/karyawan", "/api/keuangan", "/api/aset", "/api/persediaan"];

// Tambah data tanpa login (demo) - POST di beberapa endpoint jadi public
const PUBLIC_POST_PATHS = [
  "/api/pohon",
  "/api/karyawan",
  "/api/keuangan",
  "/api/aset",
  "/api/upload",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // Skip non-API atau public
  if (!pathname.startsWith("/api")) return NextResponse.next();
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Demo: allow POST tanpa login untuk tambah data
  if (method === "POST" && PUBLIC_POST_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cookieToken = req.cookies.get("token")?.value || req.cookies.get("auth-token")?.value;
    const token = bearer || cookieToken || null;
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-user-id", payload.userId);
        requestHeaders.set("x-user-role", payload.role);
        requestHeaders.set("x-user-email", payload.email);
        return NextResponse.next({ request: { headers: requestHeaders } });
      }
    }
    return NextResponse.next();
  }

  // Lapangan & geotag sekarang wajib login petugas (PETUGAS_LAPANGAN) - hapus bypass demo
  // Biarkan jatuh ke pengecekan protected di bawah yang wajib token
  // (tidak return NextResponse.next() tanpa token)

  // Cek apakah termasuk protected prefix atau /api/admin
  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) || pathname.startsWith("/api/admin");

  if (!isProtected) return NextResponse.next();

  // Ambil token dari Authorization atau Cookie
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = req.cookies.get("token")?.value || req.cookies.get("auth-token")?.value;
  const token = bearer || cookieToken || null;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Unauthorized - silakan login terlebih dahulu" },
      { status: 401 }
    );
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, message: "Unauthorized - token tidak valid atau expired" },
      { status: 401 }
    );
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-user-email", payload.email);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/api/:path*"],
};
