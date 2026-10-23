import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getDaftarProdukSnapshot } from "@/lib/daftar-produk-server";
import {
  buildDaftarProdukPdf,
  buildDaftarProdukXlsx,
  daftarProdukNamaFile,
  snapshotKeSheetDaftarProduk,
} from "@/lib/daftar-produk-export";

// GET /api/keuangan/laporan/daftar-produk?cari=&format=json|pdf|xlsx
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
// Daftar produk dari master Produk (terintegrasi Penjualan & Pembelian);
// stok dihitung dari stok awal + mutasi (masuk - keluar), tanpa pembagian gudang.
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }
    const cari = searchParams.get("cari") ?? "";

    const snapshot = await getDaftarProdukSnapshot(cari);

    if (format === "json") return successResponse(snapshot);

    if (format === "pdf") {
      const buf = buildDaftarProdukPdf([snapshot]);
      const name = daftarProdukNamaFile("pdf");
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildDaftarProdukXlsx([snapshotKeSheetDaftarProduk(snapshot, "Daftar Produk")]);
    const name = daftarProdukNamaFile("xlsx");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun laporan Daftar Produk", 400);
  }
}
