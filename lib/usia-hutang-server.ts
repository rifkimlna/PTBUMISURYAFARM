// Service Laporan Usia Hutang Pembelian PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Aging dari data aktual database (tanpa dummy), di atas Tagihan HUTANG
// (utang yang dihasilkan Faktur Pembelian):
// - Hanya tagihan HUTANG bertanggal <= tanggal acuan.
// - Sisa per faktur = jumlah − pembayaran (TransaksiKas tertaut) bertanggal
//   <= tanggal acuan. Faktur yang sudah lunas (sisa <= 0) TIDAK dihitung.
// - Umur = tanggal acuan − tanggal jatuh tempo faktur (fallback tanggal
//   faktur bila jatuh tempo kosong), dalam hari kalender (logika aging Mekari).
// - Bucket: umur <= 30 -> 1–30 Hari; 31–60; 61–90; > 90 -> > 90 Hari.
// - Dikelompokkan per supplier (nama dari FakturPembelian bila ada, sonst
//   pihak Tagihan). Subtotal per supplier + grand total.
//
// Filter lanjutan (opsional, diterapkan konsisten ke tabel/PDF/XLSX):
// - supplier: cocokkan sebagian nama (case-insensitive).
// - kategori: batasi hanya faktur pada kelompok umur terpilih.

import { prisma } from "@/lib/prisma";
import { akhirUntukUsiaHutang } from "@/lib/usia-hutang-types";
import type {
  KategoriAgingHutang,
  UsiaHutangGrup,
  UsiaHutangPeriode,
  UsiaHutangSnapshot,
} from "@/lib/usia-hutang-types";

export {
  USIA_HUTANG_PERIODE,
  USIA_HUTANG_PERIODE_LABEL,
  USIA_HUTANG_KATEGORI,
  akhirUntukUsiaHutang,
} from "@/lib/usia-hutang-types";
export type {
  KategoriAgingHutang,
  UsiaHutangBaris,
  UsiaHutangGrup,
  UsiaHutangPeriode,
  UsiaHutangSnapshot,
} from "@/lib/usia-hutang-types";

// ---------- Tanggal acuan (kalender lokal) ----------

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  const x = startOfDay(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function fmtTgl(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function resolveUsiaHutangTanggal(
  periode: UsiaHutangPeriode,
  tanggal?: string
): { asOf: Date; label: string } {
  let d: Date;
  if (periode === "custom") {
    if (!tanggal) throw new Error("Tanggal wajib diisi");
    d = startOfDay(new Date(tanggal));
    if (Number.isNaN(d.getTime())) throw new Error("Tanggal tidak valid");
  } else {
    d = akhirUntukUsiaHutang(periode);
  }
  const now = new Date();
  const asOf = d.getTime() > now.getTime() ? endOfDay(now) : endOfDay(d);
  return { asOf, label: `Per ${fmtTgl(asOf)}` };
}

function kategoriOf(umur: number): KategoriAgingHutang {
  if (umur <= 30) return "1 - 30 Hari";
  if (umur <= 60) return "31 - 60 Hari";
  if (umur <= 90) return "61 - 90 Hari";
  return "> 90 Hari";
}

export type UsiaHutangFilter = {
  /** Substring nama supplier (case-insensitive), kosong = semua. */
  supplier?: string;
  /** Batasi hanya faktur pada kelompok umur ini, kosong = semua. */
  kategori?: KategoriAgingHutang;
};

export async function getUsiaHutangSnapshot(
  asOf: Date,
  label: string,
  filter: UsiaHutangFilter = {}
): Promise<UsiaHutangSnapshot> {
  const lte = { lte: asOf };
  const num = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
  const basisHari = startOfDay(asOf).getTime();
  const supplierFilter = (filter.supplier ?? "").trim().toLowerCase();
  const kategoriFilter = filter.kategori;

  const tagihan = await prisma.tagihan.findMany({
    where: { tipe: "HUTANG", tanggal: lte },
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
      fakturPembelian: {
        select: {
          noFaktur: true,
          memo: true,
          supplier: { select: { nama: true } },
        },
      },
    },
  });

  const grupMap = new Map<string, UsiaHutangGrup>();
  let totalTransaksi = 0;

  for (const t of tagihan) {
    const jumlah = num(t.jumlah);
    const dibayar = t.pembayaran.reduce((s, p) => s + num(p.jumlah), 0);
    const sisa = Math.max(0, Math.round((jumlah - dibayar) * 100) / 100);
    if (sisa <= 0.005) continue; // sudah lunas per tanggal acuan

    const supplier = t.fakturPembelian?.supplier?.nama?.trim() || t.pihak?.trim() || "—";
    if (supplierFilter && !supplier.toLowerCase().includes(supplierFilter)) continue;

    const basis = t.jatuhTempo ? startOfDay(t.jatuhTempo) : startOfDay(t.tanggal);
    const umur = Math.floor((basisHari - basis.getTime()) / 86400000);
    const kategori = kategoriOf(umur);
    if (kategoriFilter && kategori !== kategoriFilter) continue;

    const g = grupMap.get(supplier) ?? { supplier, baris: [], total: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
    g.baris.push({
      id: t.id,
      tanggal: t.tanggal.toISOString(),
      transaksi: "Faktur",
      no: t.fakturPembelian?.noFaktur?.trim() || t.noInvoice?.trim() || "—",
      deskripsi: t.keterangan?.trim() || t.fakturPembelian?.memo?.trim() || "Faktur pembelian",
      jatuhTempo: t.jatuhTempo ? t.jatuhTempo.toISOString() : null,
      jumlah,
      sisa,
      umurHari: umur,
      kategori,
    });
    g.total = Math.round((g.total + sisa) * 100) / 100;
    if (kategori === "1 - 30 Hari") g.b1 = Math.round((g.b1 + sisa) * 100) / 100;
    else if (kategori === "31 - 60 Hari") g.b2 = Math.round((g.b2 + sisa) * 100) / 100;
    else if (kategori === "61 - 90 Hari") g.b3 = Math.round((g.b3 + sisa) * 100) / 100;
    else g.b4 = Math.round((g.b4 + sisa) * 100) / 100;
    totalTransaksi += 1;
    grupMap.set(supplier, g);
  }

  const grup = [...grupMap.values()].sort((a, b) => a.supplier.localeCompare(b.supplier, "id"));
  return {
    label,
    tanggal: asOf.toISOString(),
    grup,
    total: Math.round(grup.reduce((s, g) => s + g.total, 0) * 100) / 100,
    totalB1: Math.round(grup.reduce((s, g) => s + g.b1, 0) * 100) / 100,
    totalB2: Math.round(grup.reduce((s, g) => s + g.b2, 0) * 100) / 100,
    totalB3: Math.round(grup.reduce((s, g) => s + g.b3, 0) * 100) / 100,
    totalB4: Math.round(grup.reduce((s, g) => s + g.b4, 0) * 100) / 100,
    totalTransaksi,
  };
}
