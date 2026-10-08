// Service Laporan Usia Piutang PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Aging dari data aktual database (tanpa dummy), di atas snapshot Piutang
// Pelanggan (sumber yang sama: Tagihan PIUTANG − pembayaran per tanggal):
// - Umur = tanggal laporan − tanggal jatuh tempo invoice (fallback tanggal
//   invoice bila jatuh tempo kosong), dalam hari kalender.
// - Bucket: umur <= 30 -> 1–30 Hari; 31–60; 61–90; > 90 -> > 90 Hari.
// - Total per pelanggan = jumlah seluruh sisa piutangnya.

import { akhirUntukUsia } from "@/lib/usia-piutang-types";
import {
  getPiutangPelangganSnapshot,
  type PiutangBaris,
} from "@/lib/piutang-pelanggan-server";
import type {
  KategoriAging,
  UsiaGrup,
  UsiaPiutangPeriode,
  UsiaPiutangSnapshot,
} from "@/lib/usia-piutang-types";

export {
  USIA_PIUTANG_PERIODE,
  USIA_PIUTANG_PERIODE_LABEL,
  akhirUntukUsia,
} from "@/lib/usia-piutang-types";
export type {
  KategoriAging,
  UsiaBaris,
  UsiaGrup,
  UsiaPiutangPeriode,
  UsiaPiutangSnapshot,
} from "@/lib/usia-piutang-types";

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

export function resolveUsiaTanggal(
  periode: UsiaPiutangPeriode,
  tanggal?: string
): { asOf: Date; label: string } {
  let d: Date;
  if (periode === "custom") {
    if (!tanggal) throw new Error("Tanggal wajib diisi");
    d = startOfDay(new Date(tanggal));
    if (Number.isNaN(d.getTime())) throw new Error("Tanggal tidak valid");
  } else {
    d = akhirUntukUsia(periode);
  }
  const now = new Date();
  const asOf = d.getTime() > now.getTime() ? endOfDay(now) : endOfDay(d);
  return { asOf, label: `Per ${fmtTgl(asOf)}` };
}

function kategoriOf(umur: number): KategoriAging {
  if (umur <= 30) return "1 - 30 Hari";
  if (umur <= 60) return "31 - 60 Hari";
  if (umur <= 90) return "61 - 90 Hari";
  return "> 90 Hari";
}

export async function getUsiaPiutangSnapshot(asOf: Date, label: string): Promise<UsiaPiutangSnapshot> {
  const dasar = await getPiutangPelangganSnapshot(asOf, label);
  const basisHari = startOfDay(asOf).getTime();

  const grupMap = new Map<string, UsiaGrup>();
  let totalTransaksi = 0;

  const dorong = (pelanggan: string, b: PiutangBaris) => {
    const basis = b.jatuhTempo ? startOfDay(new Date(b.jatuhTempo)) : startOfDay(new Date(b.tanggal));
    const umur = Math.floor((basisHari - basis.getTime()) / 86400000);
    const kategori = kategoriOf(umur);
    const g = grupMap.get(pelanggan) ?? { pelanggan, baris: [], total: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
    g.baris.push({
      id: b.id,
      tanggal: b.tanggal,
      transaksi: b.transaksi,
      no: b.no,
      deskripsi: b.deskripsi,
      jumlah: b.jumlah,
      sisa: b.sisa,
      umurHari: umur,
      kategori,
    });
    g.total += b.sisa;
    if (kategori === "1 - 30 Hari") g.b1 += b.sisa;
    else if (kategori === "31 - 60 Hari") g.b2 += b.sisa;
    else if (kategori === "61 - 90 Hari") g.b3 += b.sisa;
    else g.b4 += b.sisa;
    totalTransaksi += 1;
    grupMap.set(pelanggan, g);
  };

  for (const g of dasar.grup) {
    for (const b of g.baris) dorong(g.pelanggan, b);
  }

  const grup = [...grupMap.values()].sort((a, b) => a.pelanggan.localeCompare(b.pelanggan, "id"));
  return {
    label,
    tanggal: asOf.toISOString(),
    grup,
    total: grup.reduce((s, g) => s + g.total, 0),
    totalB1: grup.reduce((s, g) => s + g.b1, 0),
    totalB2: grup.reduce((s, g) => s + g.b2, 0),
    totalB3: grup.reduce((s, g) => s + g.b3, 0),
    totalB4: grup.reduce((s, g) => s + g.b4, 0),
    totalTransaksi,
  };
}
