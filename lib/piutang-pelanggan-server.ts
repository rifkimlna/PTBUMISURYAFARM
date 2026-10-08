// Service Laporan Piutang Pelanggan PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Laporan posisi "per tanggal" dari data aktual database (tanpa dummy):
// - Tagihan PIUTANG bertanggal <= tanggal laporan.
// - Sisa per invoice = jumlah − pembayaran (TransaksiKas tertaut) bertanggal
//   <= tanggal laporan. Hanya yang sisa > 0 yang tampil (sudah lunas per
//   tanggal itu dikecualikan — konsisten dengan sisa Tagihan berjalan).
// - Dikelompokkan per pelanggan (nama dari DokumenPenjualan bila ada,
//   sonst pihak Tagihan). Subtotal per pelanggan + grand total.

import { prisma } from "@/lib/prisma";
import { akhirUntuk } from "@/lib/piutang-pelanggan-types";
import type {
  PiutangGrup,
  PiutangPelangganPeriode,
  PiutangPelangganSnapshot,
} from "@/lib/piutang-pelanggan-types";

export {
  PIUTANG_PELANGGAN_PERIODE,
  PIUTANG_PELANGGAN_PERIODE_LABEL,
} from "@/lib/piutang-pelanggan-types";
export type {
  PiutangBaris,
  PiutangGrup,
  PiutangPelangganPeriode,
  PiutangPelangganSnapshot,
} from "@/lib/piutang-pelanggan-types";

// ---------- Tanggal posisi (kalender lokal) ----------

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  const x = startOfDay(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtTgl(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function resolvePiutangTanggal(
  periode: PiutangPelangganPeriode,
  tanggal?: string
): { asOf: Date; label: string } {
  let d: Date;
  if (periode === "custom") {
    if (!tanggal) throw new Error("Tanggal wajib diisi");
    d = startOfDay(new Date(tanggal));
    if (Number.isNaN(d.getTime())) throw new Error("Tanggal tidak valid");
  } else {
    d = akhirUntuk(periode);
  }
  const now = new Date();
  const asOf = d.getTime() > now.getTime() ? endOfDay(now) : endOfDay(d);
  return { asOf, label: `Per ${fmtTgl(asOf)}` };
}

// ---------- Query snapshot ----------

export async function getPiutangPelangganSnapshot(asOf: Date, label: string): Promise<PiutangPelangganSnapshot> {
  const lte = { lte: asOf };
  const num = (v: unknown) => Math.round(Number(v ?? 0));

  const tagihan = await prisma.tagihan.findMany({
    where: { tipe: "PIUTANG", tanggal: lte },
    orderBy: [{ pihak: "asc" }, { tanggal: "asc" }],
    select: {
      id: true,
      pihak: true,
      keterangan: true,
      jumlah: true,
      tanggal: true,
      jatuhTempo: true,
      noInvoice: true,
      pembayaran: { where: { tanggal: lte }, select: { jumlah: true } },
      dokumenPenjualan: {
        select: {
          noDokumen: true,
          memo: true,
          pelanggan: { select: { nama: true } },
        },
      },
    },
  });

  const grupMap = new Map<string, PiutangGrup>();
  let totalTransaksi = 0;

  for (const t of tagihan) {
    const jumlah = num(t.jumlah);
    const dibayar = t.pembayaran.reduce((s, p) => s + num(p.jumlah), 0);
    const sisa = Math.max(0, Math.round((jumlah - dibayar) * 100) / 100);
    if (sisa <= 0.005) continue; // lunas per tanggal laporan
    totalTransaksi += 1;

    const pelanggan = t.dokumenPenjualan?.pelanggan?.nama?.trim() || t.pihak?.trim() || "—";
    const g = grupMap.get(pelanggan) ?? { pelanggan, baris: [], totalJumlah: 0, totalSisa: 0 };
    g.baris.push({
      id: t.id,
      tanggal: t.tanggal.toISOString(),
      transaksi: "Invoice",
      no: t.noInvoice?.trim() || t.dokumenPenjualan?.noDokumen?.trim() || "—",
      deskripsi: t.keterangan?.trim() || t.dokumenPenjualan?.memo?.trim() || "Invoice penjualan",
      jatuhTempo: t.jatuhTempo ? t.jatuhTempo.toISOString() : null,
      jumlah,
      sisa,
    });
    g.totalJumlah += jumlah;
    g.totalSisa += sisa;
    grupMap.set(pelanggan, g);
  }

  const grup = [...grupMap.values()].sort((a, b) => a.pelanggan.localeCompare(b.pelanggan, "id"));
  const grandJumlah = grup.reduce((s, g) => s + g.totalJumlah, 0);
  const grandSisa = grup.reduce((s, g) => s + g.totalSisa, 0);

  return {
    label,
    tanggal: asOf.toISOString(),
    grup,
    grandJumlah,
    grandSisa,
    totalTransaksi,
  };
}
