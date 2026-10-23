import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  RINGKASAN_ASET_PERIODE,
  resolveRingkasanAsetPeriode,
  getPenjualanPelepasanSnapshot,
} from "@/lib/penjualan-pelepasan-aset-server";
import type { RingkasanAsetPeriode } from "@/lib/penjualan-pelepasan-aset-types";
import {
  buildPenjualanPelepasanPdf,
  buildXlsx,
  penjualanPelepasanNamaFile,
  snapshotKeSheetPenjualanPelepasan,
} from "@/lib/penjualan-pelepasan-aset-export";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/keuangan/laporan/penjualan-pelepasan-aset?periode=bulan-ini&tanggalAwal=&tanggalAkhir=&format=json|pdf|xlsx
//
// Laporan riwayat penjualan/pelepasan aset tetap. Tanggal ayar digunakan untuk
// filter tanggal pelepasan aset.
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
    const snapshot = await getPenjualanPelepasanSnapshot(dari, sampai, periode, label);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildPenjualanPelepasanPdf([snapshot]);
      const name = penjualanPelepasanNamaFile("pdf", dari, sampai);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetPenjualanPelepasan(snapshot, "Penjualan Pelepasan Aset")]);
    const name = penjualanPelepasanNamaFile("xlsx", dari, sampai);
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
      e instanceof Error ? e.message : "Gagal menyusun laporan Penjualan/Pelepasan Aset",
      400
    );
  }
}
