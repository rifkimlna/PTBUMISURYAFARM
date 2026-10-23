import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getRingkasanStokSnapshot, labelRingkasanStok } from "@/lib/ringkasan-stok-server";
import {
  buildRingkasanStokPdf,
  buildXlsx,
  ringkasanStokNamaFile,
  snapshotKeSheetRingkasan,
} from "@/lib/ringkasan-stok-export";
import { tanggalYMD } from "@/lib/ringkasan-stok-types";

// Selalu hitung ulang dari database (tanpa cache) agar laporan realtime.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseTanggal(s: string | null): Date {
  if (!s) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error("Tanggal tidak valid");
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) throw new Error("Tanggal tidak valid");
  return d;
}

// GET /api/keuangan/laporan/ringkasan-stok?tanggal=YYYY-MM-DD&format=json|pdf|xlsx
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }

    const tanggal = parseTanggal(searchParams.get("tanggal"));
    const label = labelRingkasanStok(tanggal);
    const snapshot = await getRingkasanStokSnapshot(tanggal, label);

    if (format === "json") return successResponse(snapshot);

    const kunciTanggal = tanggalYMD(tanggal);
    if (format === "pdf") {
      const buf = buildRingkasanStokPdf([snapshot]);
      const name = ringkasanStokNamaFile("pdf", kunciTanggal);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetRingkasan(snapshot, "Ringkasan Stok Produk")]);
    const name = ringkasanStokNamaFile("xlsx", kunciTanggal);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun laporan Ringkasan Stok Produk", 400);
  }
}
