// Helper cascade hapus rantai Tagihan <-> dokumen sumber (KHUSUS server).
// JANGAN diimpor dari Client Component — hanya API route.
//
// Satu sumber logic agar hapus dari halaman mana pun konsisten dan tidak
// pernah meninggalkan yatim:
// - DokumenPenjualan -> Tagihan PIUTANG (cerminan DELETE /api/penjualan/dokumen/[id])
// - FakturPembelian -> Tagihan HUTANG (cerminan DELETE /api/pembelian/faktur/[id])
// - Biaya (bayar nanti) -> Tagihan HUTANG
//
// Semua helper berjalan di dalam transaksi caller (menerima tx) dan
// mengembalikan URL lampiran untuk dihapus dari storage SETELAH commit
// (pola yang sama dengan kedua route asal).

import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type HasilHapusSumber = {
  /** Nomor dokumen sumber yang ikut terhapus (untuk pesan konfirmasi). */
  label: string;
  /** URL file lampiran untuk dihapus setelah commit. */
  hapusUrls: string[];
};

// ---------- Dokumen Penjualan (+ piutang ikutannya bila belum dibayar) ----------

export async function hapusDokumenPenjualanSumber(
  tx: Tx,
  dokumenId: string
): Promise<HasilHapusSumber> {
  const dokumen = await tx.dokumenPenjualan.findUnique({
    where: { id: dokumenId },
    select: { id: true, tipe: true, noDokumen: true, tagihanId: true, referensiIds: true, tanggal: true },
  });
  if (!dokumen) throw new Error("Dokumen penjualan tidak ditemukan");

  const lampiran = await tx.dokumenLampiran.findMany({
    where: { dokumenId },
    select: { fileUrl: true },
  });

  // Balikan stok penjualan (PENAGIHAN): buat riwayat MASUK sejumlah KELUAR yang
  // pernah dicatat saat penjualan, agar hapus tidak mengubah stok secara ganda.
  if (dokumen.tipe === "PENAGIHAN") {
    const items = await tx.dokumenPenjualanItem.findMany({
      where: { dokumenId },
      select: { produkId: true, kuantitas: true },
    });
    for (const it of items) {
      if (it.produkId && Number(it.kuantitas) > 0) {
        await tx.riwayatStok.create({
          data: {
            barangId: it.produkId,
            jenis: "MASUK",
            jumlah: Number(it.kuantitas),
            keterangan: `Reversal: hapus penjualan ${dokumen.noDokumen}`,
            sumber: "PENJUALAN",
            tanggal: dokumen.tanggal ?? new Date(),
          },
        });
      }
    }
  }

  if (dokumen.tagihanId) {
    const bayarCount = await tx.transaksiKas.count({ where: { tagihanId: dokumen.tagihanId } });
    if (bayarCount > 0) {
      throw new Error("Dokumen tidak bisa dihapus karena piutangnya sudah ada pembayaran");
    }
    await tx.tagihan.delete({ where: { id: dokumen.tagihanId } });
  }

  await tx.dokumenPenjualan.delete({ where: { id: dokumenId } });

  // Kembalikan dokumen asal ke Belum Ditagih bila sudah tidak dirujuk dokumen lain
  // dan (untuk pesanan) sudah tidak ada pengirimannya.
  if (dokumen.referensiIds.length > 0) {
    const asal = await tx.dokumenPenjualan.findMany({
      where: { id: { in: dokumen.referensiIds }, tipe: { in: ["PESANAN", "PENAWARAN"] } },
      select: { id: true, tipe: true },
    });
    for (const a of asal) {
      const [masihDirujuk, sisaKirim] = await Promise.all([
        tx.dokumenPenjualan.count({ where: { referensiIds: { has: a.id } } }),
        a.tipe === "PESANAN"
          ? tx.pengirimanPenjualan.count({ where: { pesananId: a.id } })
          : Promise.resolve(1),
      ]);
      if (masihDirujuk === 0 && sisaKirim === 0) {
        await tx.dokumenPenjualan.updateMany({
          where: { id: a.id },
          data: { status: "BELUM_DITAGIH" },
        });
      }
    }
  }

  return { label: dokumen.noDokumen, hapusUrls: lampiran.map((l: { fileUrl: string }) => l.fileUrl) };
}

// ---------- Faktur Pembelian (+ utang ikutannya bila belum dibayar) ----------

export async function hapusFakturPembelianSumber(
  tx: Tx,
  fakturId: string
): Promise<HasilHapusSumber> {
  const faktur = await tx.fakturPembelian.findUnique({
    where: { id: fakturId },
    select: { id: true, noFaktur: true, tagihanId: true, referensiIds: true },
  });
  if (!faktur) throw new Error("Faktur tidak ditemukan");

  const lampiran = await tx.fakturPembelianLampiran.findMany({
    where: { fakturId },
    select: { fileUrl: true },
  });

  if (faktur.tagihanId) {
    const bayarCount = await tx.transaksiKas.count({ where: { tagihanId: faktur.tagihanId } });
    if (bayarCount > 0) {
      throw new Error("Faktur tidak bisa dihapus karena utangnya sudah ada pembayaran");
    }
    await tx.tagihan.delete({ where: { id: faktur.tagihanId } });
  }

  await tx.fakturPembelian.delete({ where: { id: fakturId } });

  // Kembalikan dokumen asal ke Belum Ditagih bila sudah yatim.
  if (faktur.referensiIds.length > 0) {
    const asal = await tx.dokumenPembelian.findMany({
      where: { id: { in: faktur.referensiIds } },
      select: { id: true, tipe: true },
    });
    for (const a of asal) {
      const [masihDirujuk, fakturMerujuk, sisaKirim] = await Promise.all([
        tx.dokumenPembelian.count({ where: { referensiIds: { has: a.id } } }),
        tx.fakturPembelian.count({ where: { referensiIds: { has: a.id } } }),
        a.tipe === "PESANAN" ? tx.pengirimanPembelian.count({ where: { pesananId: a.id } }) : Promise.resolve(1),
      ]);
      if (masihDirujuk === 0 && fakturMerujuk === 0 && sisaKirim === 0) {
        await tx.dokumenPembelian.updateMany({
          where: { id: a.id },
          data: { status: "BELUM_DITAGIH" },
        });
      }
    }
  }

  return { label: faktur.noFaktur, hapusUrls: lampiran.map((l: { fileUrl: string }) => l.fileUrl) };
}

// ---------- Biaya bayar-nanti (baris biayanya ikut terhapus) ----------

export async function hapusBiayaSumber(tx: Tx, biayaId: string): Promise<HasilHapusSumber> {
  const biaya = await tx.biaya.findUnique({
    where: { id: biayaId },
    select: { id: true, noBiaya: true, tagihanId: true },
  });
  if (!biaya) throw new Error("Biaya tidak ditemukan");

  if (biaya.tagihanId) {
    const bayarCount = await tx.transaksiKas.count({ where: { tagihanId: biaya.tagihanId } });
    if (bayarCount > 0) {
      throw new Error("Biaya tidak bisa dihapus karena utangnya sudah ada pembayaran");
    }
    await tx.tagihan.delete({ where: { id: biaya.tagihanId } });
  }

  await tx.biaya.delete({ where: { id: biayaId } });

  return { label: biaya.noBiaya, hapusUrls: [] };
}
