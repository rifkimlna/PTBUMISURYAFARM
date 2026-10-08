import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getAnggaranDetailSnapshot } from "@/lib/anggaran-laporan-server";
import {
  anggaranNamaFile,
  buildAnggaranPdf,
  buildXlsx,
  snapshotKeSheetAnggaran,
} from "@/lib/anggaran-laporan-export";

// GET /api/keuangan/laporan/anggaran-laporan?id=...[&format=json|pdf|xlsx]
// Detail satu anggaran (periode tersimpan) — satu sumber data untuk
// halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) return errorResponse("id anggaran wajib diisi", 400);

    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }

    const snapshot = await getAnggaranDetailSnapshot(id);

    if (format === "json") {
      return successResponse({ mode: "single", snapshot });
    }

    if (format === "pdf") {
      const buf = buildAnggaranPdf([snapshot]);
      const name = anggaranNamaFile("pdf", snapshot);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetAnggaran(snapshot, "Anggaran Laba Rugi")]);
    const name = anggaranNamaFile("xlsx", snapshot);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun laporan anggaran", 400);
  }
}
