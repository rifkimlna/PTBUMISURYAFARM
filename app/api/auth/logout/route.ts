import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true, message: "Logout berhasil" });
  res.cookies.set("token", "", { httpOnly: true, maxAge: 0, path: "/" });
  res.cookies.set("auth-token", "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}
export async function GET() {
  return POST();
}
