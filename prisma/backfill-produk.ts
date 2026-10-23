// Backfill satu kali: daftarkan produk dari transaksi lama ke master Permintaan
// agar modul Penjualan dan halaman Produk memakai sumber data yang sama.
//
// ATURAN (sesuai kesepakatan):
// - Produk dari item PENJUALAN: didaftarkan ke master + kolom produkId item diisi.
// - Produk dari item PEMBELIAN: hanya didaftarkan ke master; produkId item lama
//   TIDAK diisi agar akun COA faktur lama tidak berisiko berubah saat diedit.
// - Pencocokan nama dibuat case-insensitive + trim (tidak membuat duplikat).
// - Produk baru: kategori "Bibit/Benih", stok 0, TANPA riwayat stok.
// - Nominal/kuantitas/harga/kodeAkun transaksi lama tidak diubah.
// - Idempoten: aman dijalankan berulang.
//
// Jalankan: npx tsx prisma/backfill-produk.ts

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { pastikanProdukId } from "@/lib/produk-master";

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const ringkasan = await prisma.$transaction(async (tx) => {
    const idSebelum = new Set(
      (await tx.persediaanBarang.findMany({ select: { id: true } })).map((r: { id: string }) => r.id)
    );

    let itemJualDiproses = 0;
    let itemJualDitautkan = 0;
    let itemBeliDiproses = 0;
    let itemDilewati = 0;

    // --- Penjualan: daftarkan produk + tautkan produkId item ---
    const itemJual = await tx.dokumenPenjualanItem.findMany({
      where: { produkId: null },
      select: { id: true, deskripsi: true, unit: true, harga: true },
      orderBy: { id: "asc" },
    });
    for (const it of itemJual) {
      itemJualDiproses += 1;
      const produkId = await pastikanProdukId(tx, {
        nama: it.deskripsi,
        satuan: it.unit,
        hargaJual: toNumber(it.harga),
      });
      if (!produkId) {
        itemDilewati += 1;
        continue;
      }
      await tx.dokumenPenjualanItem.update({ where: { id: it.id }, data: { produkId } });
      itemJualDitautkan += 1;
    }

    // --- Pembelian: daftarkan produk saja (tanpa menautkan produkId item) ---
    const itemBeli = await tx.fakturPembelianItem.findMany({
      where: { produkId: null },
      select: { id: true, deskripsi: true, unit: true, harga: true },
      orderBy: { id: "asc" },
    });
    for (const it of itemBeli) {
      itemBeliDiproses += 1;
      const produkId = await pastikanProdukId(tx, {
        nama: it.deskripsi,
        satuan: it.unit,
        hargaBeli: toNumber(it.harga),
      });
      if (!produkId) itemDilewati += 1;
    }

    const produkBaru = await tx.persediaanBarang.findMany({
      where: { id: { notIn: Array.from(idSebelum) } },
      select: { id: true, namaBarang: true, kategori: true, satuan: true, stokAwal: true },
      orderBy: { id: "asc" },
    });
    const totalMaster = await tx.persediaanBarang.count();

    return {
      itemJualDiproses,
      itemJualDitautkan,
      itemBeliDiproses,
      itemDilewati,
      produkBaru,
      totalMaster,
    };
  });

  console.log("=== Backfill Produk selesai ===");
  console.log(`Item penjualan diproses   : ${ringkasan.itemJualDiproses}`);
  console.log(`Item penjualan ditautkan  : ${ringkasan.itemJualDitautkan}`);
  console.log(`Item pembelian diproses   : ${ringkasan.itemBeliDiproses} (produkId item tidak diubah)`);
  console.log(`Item dilewati (nama tidak valid untuk master): ${ringkasan.itemDilewati}`);
  console.log(`Produk baru dibuat        : ${ringkasan.produkBaru.length}`);
  for (const p of ringkasan.produkBaru) {
    console.log(`  + ${p.id}  ${p.namaBarang}  [${p.kategori}] ${p.satuan}  stokAwal=${p.stokAwal}`);
  }
  console.log(`Total produk di master    : ${ringkasan.totalMaster}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Backfill gagal:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
