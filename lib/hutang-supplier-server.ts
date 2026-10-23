// Service Laporan Hutang Supplier PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Laporan POSISI per tanggal dari data aktual database (tanpa dummy):
// - SELURUH Tagihan HUTANG bertanggal <= tanggal laporan (tanpa batas awal —
//   faktur lama yang belum lunas tetap tampil, pola yang sama dengan
//   Piutang Pelanggan & Neraca).
// - Per supplier ditampilkan mutasi ala Mekari: baris "Saldo Awal" per
//   tanggal awal periode, riwayat faktur (+) dan pembayaran (−) dalam
//   periode, lalu subtotal (saldo akhir). Credit memo/retur belum tersedia
//   di database (tidak ada modelnya) sehingga tidak ditampilkan — tanpa dummy.
// - Saldo per tagihan = jumlah − pembayaran (TransaksiKas tertaut) bertanggal
//   <= tanggal laporan. Pembayaran tervalidasi tidak melebihi sisa
//   (API tagihan menolak nominal > sisa), sehingga saldo berjalan tepat
//   merekonsiliasi ke sisa Tagihan berjalan (konsisten dengan Hutang &
//   Piutang serta Daftar Pembelian).
// - Dikelompokkan per supplier (nama dari FakturPembelian bila ada,
//   sonst pihak Tagihan). Subtotal per supplier + grand total.
// - Grand total & total transaksi dihitung dari SELURUH grup terfilter
//   (bukan hanya halaman aktif).

import { prisma } from "@/lib/prisma";
import { akhirUntukHutang } from "@/lib/hutang-supplier-types";
import type {
  HutangGrup,
  HutangSupplierPeriode,
  HutangSupplierSnapshot,
} from "@/lib/hutang-supplier-types";

export {
  HUTANG_SUPPLIER_PERIODE,
  HUTANG_SUPPLIER_PERIODE_LABEL,
} from "@/lib/hutang-supplier-types";
export type {
  HutangBaris,
  HutangGrup,
  HutangSupplierPeriode,
  HutangSupplierSnapshot,
} from "@/lib/hutang-supplier-types";

// ---------- Tanggal posisi (kalender lokal) ----------

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

export function resolveHutangTanggal(
  periode: HutangSupplierPeriode,
  tanggal?: string
): { asOf: Date; label: string } {
  let d: Date;
  if (periode === "custom") {
    if (!tanggal) throw new Error("Tanggal wajib diisi");
    d = startOfDay(new Date(tanggal));
    if (Number.isNaN(d.getTime())) throw new Error("Tanggal tidak valid");
  } else {
    d = akhirUntukHutang(periode);
  }
  const now = new Date();
  const asOf = d.getTime() > now.getTime() ? endOfDay(now) : endOfDay(d);
  return { asOf, label: `Per ${fmtTgl(asOf)}` };
}

// ---------- Query snapshot ----------

export async function getHutangSupplierSnapshot(
  asOf: Date,
  label: string,
  opts: { page?: number; limit?: number; paginate?: boolean; from?: Date } = {}
): Promise<HutangSupplierSnapshot> {
  const lte = { lte: asOf };
  const num = (v: unknown) => Math.round(Number(v ?? 0));
  const fromValid =
    opts.from instanceof Date && !Number.isNaN(opts.from.getTime()) ? startOfDay(opts.from) : undefined;
  const dalamPeriode = (d: Date) => !fromValid || d.getTime() >= fromValid.getTime();

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
      pembayaran: {
        where: { tanggal: lte },
        orderBy: { tanggal: "asc" },
        select: { id: true, tanggal: true, jumlah: true, sumberDana: true, keterangan: true, noTransaksi: true },
      },
      fakturPembelian: {
        select: {
          noFaktur: true,
          memo: true,
          supplier: { select: { nama: true } },
        },
      },
    },
  });

  const grupMap = new Map<string, HutangGrup>();
  let totalTransaksi = 0;

  for (const t of tagihan) {
    const jumlah = num(t.jumlah);
    const isPre = fromValid ? t.tanggal.getTime() < fromValid.getTime() : false;
    const bayarSebelum = fromValid
      ? t.pembayaran.filter((p) => p.tanggal.getTime() < fromValid.getTime()).reduce((s, p) => s + num(p.jumlah), 0)
      : 0;
    const bayarPeriode = t.pembayaran
      .filter((p) => dalamPeriode(p.tanggal))
      .sort((a, b) => a.tanggal.getTime() - b.tanggal.getTime());
    const totalBayarPeriode = bayarPeriode.reduce((s, p) => s + num(p.jumlah), 0);
    const fakturDalamPeriode = dalamPeriode(t.tanggal);
    const saldoAwalTagihan = isPre ? Math.max(0, Math.round((jumlah - bayarSebelum) * 100) / 100) : 0;
    const saldoAkhirTagihan = Math.max(
      0,
      Math.round((saldoAwalTagihan + (fakturDalamPeriode ? jumlah : 0) - totalBayarPeriode) * 100) / 100
    );
    // Tanpa mutasi pada periode ini dan tanpa saldo (sudah lunas per
    // tanggal laporan): dikecualikan — konsisten dengan sisa Tagihan berjalan.
    if (saldoAwalTagihan <= 0.005 && !fakturDalamPeriode && totalBayarPeriode <= 0.005) continue;
    // Faktur periode ini yang tidak menambah saldo dan tanpa pembayaran
    // periode ini (kasus data tak wajar) tidak ditampilkan agar saldo
    // berjalan tetap merekonsiliasi ke sisa Tagihan.
    if (fakturDalamPeriode && saldoAkhirTagihan <= 0.005 && totalBayarPeriode <= 0.005) continue;

    const supplier = t.fakturPembelian?.supplier?.nama?.trim() || t.pihak?.trim() || "—";
    const noFaktur = t.fakturPembelian?.noFaktur?.trim() || t.noInvoice?.trim() || "—";
    const g =
      grupMap.get(supplier) ??
      { supplier, baris: [], saldoAwal: 0, totalFaktur: 0, totalBayar: 0, totalJumlah: 0, totalSaldo: 0 };
    g.saldoAwal = Math.round((g.saldoAwal + saldoAwalTagihan) * 100) / 100;
    if (fakturDalamPeriode) {
      totalTransaksi += 1;
      g.totalFaktur += jumlah;
      g.totalJumlah += jumlah;
      g.baris.push({
        id: t.id,
        tanggal: t.tanggal.toISOString(),
        jenis: "faktur",
        transaksi: "Faktur",
        no: noFaktur,
        jatuhTempo: t.jatuhTempo ? t.jatuhTempo.toISOString() : null,
        keterangan: t.keterangan?.trim() || t.fakturPembelian?.memo?.trim() || "Faktur pembelian",
        jumlah,
        saldo: 0, // diisi saldo berjalan di bawah
      });
    }
    for (const p of bayarPeriode) {
      const nominal = num(p.jumlah);
      g.totalBayar += nominal;
      const ketDetail = p.keterangan?.trim() || "";
      g.baris.push({
        id: `bayar-${p.id}`,
        tanggal: p.tanggal.toISOString(),
        jenis: "pembayaran",
        transaksi: "Pembayaran",
        no: p.noTransaksi?.trim() || "—",
        jatuhTempo: null,
        keterangan:
          `Pembayaran ${String(p.sumberDana).replace(/_/g, " ")} — ${noFaktur}` +
          (ketDetail ? ` — ${ketDetail}` : ""),
        jumlah: -nominal,
        saldo: 0, // diisi saldo berjalan di bawah
      });
    }
    grupMap.set(supplier, g);
  }

  // Susun kronologis per supplier: saldo awal dulu, lalu faktur sebelum
  // pembayaran pada tanggal yang sama, dan isi saldo berjalan + total akhir.
  const semua: HutangGrup[] = [];
  for (const g of grupMap.values()) {
    const mutasi = g.baris.sort((a, b) => {
      const s = new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
      if (s !== 0) return s;
      return (a.jenis === "faktur" ? 0 : 1) - (b.jenis === "faktur" ? 0 : 1);
    });
    let jalan = Math.round(g.saldoAwal * 100) / 100;
    const baris: HutangGrup["baris"] = [];
    if (fromValid) {
      baris.push({
        id: `saldo-awal:${g.supplier}`,
        tanggal: fromValid.toISOString(),
        jenis: "saldo-awal",
        transaksi: "Saldo Awal",
        no: "—",
        jatuhTempo: null,
        keterangan: "Saldo awal hutang supplier",
        jumlah: 0,
        saldo: jalan,
      });
    }
    for (const m of mutasi) {
      jalan = Math.round((jalan + m.jumlah) * 100) / 100;
      baris.push({ ...m, saldo: jalan });
    }
    g.baris = baris;
    g.saldoAwal = Math.round(g.saldoAwal * 100) / 100;
    g.totalFaktur = Math.round(g.totalFaktur * 100) / 100;
    g.totalBayar = Math.round(g.totalBayar * 100) / 100;
    g.totalJumlah = Math.round(g.totalJumlah * 100) / 100;
    g.totalSaldo = Math.max(0, Math.round(jalan * 100) / 100);
    semua.push(g);
  }
  semua.sort((a, b) => a.supplier.localeCompare(b.supplier, "id"));
  const grandJumlah = semua.reduce((s, g) => s + g.totalJumlah, 0);
  const grandSaldo = semua.reduce((s, g) => s + g.totalSaldo, 0);

  let grup = semua;
  if (opts.paginate) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 10));
    grup = semua.slice((page - 1) * limit, page * limit);
  }

  return {
    label,
    tanggal: asOf.toISOString(),
    grup,
    totalGrup: semua.length,
    grandJumlah,
    grandSaldo,
    totalTransaksi,
  };
}
