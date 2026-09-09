import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function successResponse<T>(data: T, message = "OK", status = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

export function errorResponse(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, message, details }, { status });
}

export function zodErrorResponse(error: ZodError) {
  const details = error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  return NextResponse.json(
    { success: false, message: "Validasi gagal", errors: details },
    { status: 400 }
  );
}

export function unauthorizedResponse(msg = "Unauthorized") {
  return errorResponse(msg, 401);
}

export function forbiddenResponse(msg = "Forbidden - akses ditolak") {
  return errorResponse(msg, 403);
}

export function notFoundResponse(msg = "Data tidak ditemukan") {
  return errorResponse(msg, 404);
}

export function handleApiError(error: unknown) {
  console.error("[API Error]", error);
  if (error instanceof ZodError) return zodErrorResponse(error);
  const message = error instanceof Error ? error.message : "Internal Server Error";
  return errorResponse(message, 500);
}
