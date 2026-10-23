// Service Laporan Mutasi Produk PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// SUMBER DATA TUNGGAL: RiwayatStok.
//
// Halaman Produk menghitung stok sebagai stokAwal + Σ(RiwayatStok MASUK)
// − Σ(RiwayatStok KELUAR). Agar saldo akhir laporan ini SAMA dengan stok di
// halaman Produk, mutasi di laporan ini juga diambil dari RiwayatStok — bukan
// dari FakturPembelian / PengirimanPembelian / DokumenPenjualan.
//
// Catatan relasi transaksi (kenapa faktur/penerimaan/penjualan tidak dihitung):
// - FakturPembelian & PengirimanPembelian (bukti penerimaan barang) TIDAK menulis
//   RiwayatStok, jadi keduanya bukan mutasi stok dan tidak mengubah stok Produk.
// - DokumenPenjualan juga TIDAK menulis RiwayatStok (barang keluar belum diposting
//   ke kartu stok), jadi penjualan tidak mengubah stok Produk.
// - Yang benar-benar mengubah stok hanya dua jalur: penyesuaian/opname manual
//   (/api/persediaan/[id]/riwayat) dan pembelian terintegrasi lama
//   (/api/persediaan/[id]/pembelian, sumber = PEMBELIAN).
// Karena itu laporan memakai RiwayatStok apa adanya: tanpa faktr yang dihitung
// dobel, tanpa mengarang stok awal, tanpa memaksa saldo negatif menjadi nol.

import { prisma } from "@/lib/prisma";
import {
  MUTASI_PRODUK_PERIODE,
  resolvePeriodeTanggal,
  type MutasiProdukPeriode,
  type JenisMutasi,
  type MutasiProdukBaris,
  type MutasiProdukSnapshot,
} from "@/lib/mutasi-produk-types";

export { MUTASI_PRODUK_PERIODE, resolvePeriodeTanggal };
export type { MutasiProdukPeriode };

/** Kategori mutasi menurut asal catatan stok. */
function jenisDariSumber(sumber: string | null): JenisMutasi {
  if (sumber === "PEMBELIAN") return "PEMBELIAN";
  if (sumber === "MANUAL") return "MANUAL";
  if (sumber === "PENYESUAIAN") return "PENYESUAIAN";
  return "STOK";
}

function labelMutasi(sumber: string | null, jenisStok: string): string {
  const arah = jenisStok === "MASUK" ? "Masuk" : "Keluar";
  if (sumber === "PEMBELIAN") return `${arah} - Pembelian`;
  if (sumber === "PENYESUAIAN" || sumber === "MANUAL") return "Penyesuaian Stok";
  return `${arah} - Riwayat Stok`;
}

export async function getMutasiProdukSnapshot(
  dari: Date,
  sampai: Date,
  label: string
): Promise<MutasiProdukSnapshot> {
  // Batas periode inklusif sampai akhir hari (agar transaksi pada tanggal akhir ikut).
  const dariAwal = new Date(dari);
  dariAwal.setHours(0, 0, 0, 0);
  const sampaiAkhir = new Date(sampai);
  sampaiAkhir.setHours(23, 59, 59, 999);

  const [produk, riwayat] = await Promise.all([
    prisma.persediaanBarang.findMany({
      select: { id: true, namaBarang: true, stokAwal: true, tipeProduk: true },
    }),
    prisma.riwayatStok.findMany({
      where: { tanggal: { lte: sampaiAkhir } },
      select: {
        id: true,
        barangId: true,
        jenis: true,
        jumlah: true,
        keterangan: true,
        sumber: true,
        tanggal: true,
        createdAt: true,
      },
      orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const byId = new Map(produk.map((p) => [p.id, p]));

  // Kelompokkan riwayat per produk (hanya produk yang masih ada di master).
  const perProduk = new Map<string, typeof riwayat>();
  for (const r of riwayat) {
    if (!byId.has(r.barangId)) continue;
    const arr = perProduk.get(r.barangId);
    if (arr) arr.push(r);
    else perProduk.set(r.barangId, [r]);
  }

  type BarisInternal = MutasiProdukBaris & { urut: number };
  const internal: BarisInternal[] = [];

  for (const [pid, list] of perProduk) {
    const p = byId.get(pid);
    if (!p) continue;
    if ((p.tipeProduk ?? "BARANG") === "JASA") continue;

    // Saldo dihitung KRONOLOGIS per produk: mutasi paling awal → paling akhir.
    list.sort(
      (a, b) => a.tanggal.getTime() - b.tanggal.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
    );

    let saldo = p.stokAwal ?? 0;
    for (const r of list) {
      const masuk = r.jenis === "MASUK" ? r.jumlah : 0;
      const keluar = r.jenis === "KELUAR" ? r.jumlah : 0;
      // Data apa adanya: saldo boleh 0/negatif, tidak dibulatkan ke nol.
      saldo += masuk - keluar;

      if (r.tanggal >= dariAwal && r.tanggal <= sampaiAkhir) {
        internal.push({
          id: r.id,
          tanggal: r.tanggal.toISOString(),
          namaProduk: p.namaBarang,
          jenis: jenisDariSumber(r.sumber),
          jenisLabel: labelMutasi(r.sumber, r.jenis),
          referensi: (r.keterangan ?? "").trim() || "—",
          stokMasuk: masuk,
          stokKeluar: keluar,
          saldo,
          urut: r.createdAt.getTime(),
        });
      }
    }
  }

  // Tampilan: mutasi terbaru lebih dahulu (saldo tetap hasil hitung kronologis).
  internal.sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime() || b.urut - a.urut
  );

  const baris: MutasiProdukBaris[] = internal.map((b) => ({
    id: b.id,
    tanggal: b.tanggal,
    namaProduk: b.namaProduk,
    jenis: b.jenis,
    jenisLabel: b.jenisLabel,
    referensi: b.referensi,
    stokMasuk: b.stokMasuk,
    stokKeluar: b.stokKeluar,
    saldo: b.saldo,
  }));

  let totalStokMasuk = 0;
  let totalStokKeluar = 0;
  for (const b of baris) {
    totalStokMasuk += b.stokMasuk;
    totalStokKeluar += b.stokKeluar;
  }

  return {
    label,
    tanggalAwal: dariAwal.toISOString(),
    tanggalAkhir: sampaiAkhir.toISOString(),
    baris,
    totalStokMasuk,
    totalStokKeluar,
    totalBaris: baris.length,
  };
}
