import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  RINGKASAN_ASET_PERIODE,
  resolveRingkasanAsetPeriode,
  getDetailAsetSnapshot,
} from "@/lib/ringkasan-aset-detail-server";
import type { RingkasanAsetPeriode } from "@/lib/ringkasan-aset-detail-types";
import {
  buildDetailAsetPdf,
  buildXlsx,
  detailAsetNamaFile,
  snapshotKeSheetDetailAset,
} from "@/lib/ringkasan-aset-detail-export";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/keuangan/laporan/detail-aset-tetap?periode=bulan-ini&tanggalAwal=&tanggalAkhir=&format=json|pdf|xlsx
//
// Laporan riwayat transaksi per aset tetap. Tanggal awal dipakai untuk
// rentang/label laporan; lihat catatan di lib/ringkasan-aset-detail-server.ts.
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const periodeRaw = searchParams.get("periode") ?? "bulan-ini";
    if (!(RINGKASAN_ASET_PERIODE as readonly string[]).includes(periodeRaw)) {
      return errorResponse("Periode tidak valid", 400);
    }
    const periode = periodeRaw as RingkasanAsetPeriode;
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const tanggalAwal = searchParams.get("tanggalAwal") ?? undefined;
    const tanggalAkhir = searchParams.get("tanggalAkhir") ?? undefined;

    const { dari, sampai, label } = resolveRingkasanAsetPeriode(
      periode,
      tanggalAwal,
      tanggalAkhir
    );
    const snapshot = await getDetailAsetSnapshot(dari, sampai, periode, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildDetailAsetPdf([snapshot]);
      const name = detailAsetNamaFile("pdf", dari, sampai);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetDetailAset(snapshot, "Detail Aset Tetap")]);
    const name = detailAsetNamaFile("xlsx", dari, sampai);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(
      e instanceof Error ? e.message : "Gagal menyusun laporan Detail Aset Tetap",
      400
    );
  }
}
