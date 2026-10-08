import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  MONITOR_LIHAT_BALIK,
  MONITOR_TAMPIL_SETIAP,
  MONITOR_TEMPLATE,
  getAnggaranMonitorSnapshot,
  type MonitorLihatBalik,
  type MonitorTampilSetiap,
} from "@/lib/anggaran-monitor-server";
import {
  anggaranMonitorNamaFile,
  buildMonitorPdf,
  buildXlsx,
  snapshotKeSheetMonitor,
} from "@/lib/anggaran-monitor-export";

// GET /api/keuangan/laporan/anggaran-laba-rugi?anggaranId=...&berakhirPada=YYYY-MM&lihatBalik=12&tampilkanSetiap=1&template=standar[&format=json|pdf|xlsx]
// Satu sumber data untuk halaman web, PDF, dan XLSX (jaminan angka konsisten).
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const anggaranId = searchParams.get("anggaranId") || "";
    if (!anggaranId) return errorResponse("anggaranId wajib diisi", 400);

    const now = new Date();
    const berakhirRaw = searchParams.get("berakhirPada") || `${now.getFullYear()}-12`;
    const m = /^(\d{4})-(\d{2})$/.exec(berakhirRaw);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) {
      return errorResponse("berakhirPada tidak valid (format YYYY-MM)", 400);
    }

    const lihatBalikRaw = Number(searchParams.get("lihatBalik") ?? 12);
    if (!(MONITOR_LIHAT_BALIK as readonly number[]).includes(lihatBalikRaw)) {
      return errorResponse("lihatBalik tidak valid (1|2|3|4|6|8|12|24)", 400);
    }
    const tampilSetiapRaw = Number(searchParams.get("tampilkanSetiap") ?? 1);
    if (!(MONITOR_TAMPIL_SETIAP as readonly number[]).includes(tampilSetiapRaw)) {
      return errorResponse("tampilkanSetiap tidak valid (1|3|4|6|12)", 400);
    }
    const templateRaw = searchParams.get("template") ?? "standar";
    if (!(MONITOR_TEMPLATE as readonly string[]).includes(templateRaw)) {
      return errorResponse("template tidak valid", 400);
    }

    const format = searchParams.get("format") ?? "json";
    if (!["json", "pdf", "xlsx"].includes(format)) {
      return errorResponse("Format tidak valid (json|pdf|xlsx)", 400);
    }

    const snapshot = await getAnggaranMonitorSnapshot({
      anggaranId,
      berakhirPada: { tahun: Number(m[1]), bulan: Number(m[2]) },
      lihatBalik: lihatBalikRaw as MonitorLihatBalik,
      tampilSetiap: tampilSetiapRaw as MonitorTampilSetiap,
    });

    if (format === "json") {
      return successResponse({ mode: "single", snapshot });
    }

    if (format === "pdf") {
      const buf = buildMonitorPdf([snapshot]);
      const name = anggaranMonitorNamaFile("pdf", snapshot.berakhirPada, snapshot.anggaranNama);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    const buf = buildXlsx([snapshotKeSheetMonitor(snapshot, "Anggaran Laba Rugi")]);
    const name = anggaranMonitorNamaFile("xlsx", snapshot.berakhirPada, snapshot.anggaranNama);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menyusun monitor anggaran", 400);
  }
}
