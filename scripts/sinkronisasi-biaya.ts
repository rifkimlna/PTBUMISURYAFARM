// Skrip sinkronisasi backfill: membuat record Biaya dari TransaksiKas PENGELUARAN lama
// yang belum memiliki baris Biaya. Tidak membuat transaksi duplikat — hanya membuat
// identitas Biaya yang menautkan ke TransaksiKas yang sudah ada via transaksiKasId.
//
// Kriteria inklusi:
//   - tipe = "PENGELUARAN"
//   - tagihanId = null (bukan pelunasan hutang)
//   - Belum ada Biaya yang menautkan transaksi kas ini (transaksiKasId belum ada di Biaya)
//
// Kriteria eksklusi (bukan beban akuntansi):
//   - kodeAkun dimulai dengan "1" (kelompok Aset — pembelian aset)
//   - kodeAkun = "5501" (Pelunasan Hutang Usaha)
//   - kategori mengandung "Pelunasan Hutang"
//   - kategori mengandung "Aset"

import { prisma } from "@/lib/prisma";

function randomSuffix(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function generateNoBiaya(tanggal: Date): Promise<string> {
  const ymd = `${tanggal.getFullYear()}${String(tanggal.getMonth() + 1).padStart(2, "0")}${String(
    tanggal.getDate()
  ).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `BY-${ymd}-${randomSuffix()}`;
    const exists = await prisma.biaya.findUnique({
      where: { noBiaya: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `BY-${ymd}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function main() {
  // Ambil semua id TransaksiKas yang sudah ditautkan ke Biaya
  const existingLinks = await prisma.biaya.findMany({
    where: { transaksiKasId: { not: null } },
    select: { transaksiKasId: true },
  });
  const linkedKasIds = new Set(existingLinks.map((b) => b.transaksiKasId!).filter(Boolean));

  // Ambil TransaksiKas PENGELUARAN yang belum ditautkan ke Biaya dan bukan tagihan
  const kasRows = await prisma.transaksiKas.findMany({
    where: {
      tipe: "PENGELUARAN",
      tagihanId: null,
      id: { notIn: [...linkedKasIds] },
    },
    orderBy: { tanggal: "asc" },
    select: {
      id: true,
      noTransaksi: true,
      tanggal: true,
      kategori: true,
      kodeAkun: true,
      pihak: true,
      jumlah: true,
      sumberDana: true,
      keterangan: true,
      adminId: true,
    },
  });

  let created = 0;
  let skipped = 0;
  const skipReasons: Record<string, number> = {};

  for (const k of kasRows) {
    const kodeAkun = k.kodeAkun ?? "";
    const kategori = (k.kategori ?? "").toUpperCase();

    // Eksklusi: pembelian aset (kodeAkun dimulai dengan "1" = kelompok Aset)
    if (kodeAkun.startsWith("1")) {
      skipReasons["aset_kode_akun"] = (skipReasons["aset_kode_akun"] || 0) + 1;
      skipped++;
      continue;
    }

    // Eksklusi: kategori terkait aset
    if (kategori.includes("ASET") || kategori.includes("AKUISISI")) {
      skipReasons["aset_kategori"] = (skipReasons["aset_kategori"] || 0) + 1;
      skipped++;
      continue;
    }

    const noBiaya = await generateNoBiaya(k.tanggal);

    await prisma.biaya.create({
      data: {
        noBiaya,
        tanggal: k.tanggal,
        jatuhTempo: null,
        kategori: k.kategori,
        kodeAkun: k.kodeAkun,
        penerima: k.pihak ?? "-",
        jumlah: Number(k.jumlah),
        sisa: 0,
        status: "LUNAS",
        tags: null,
        memo: k.keterangan ?? null,
        tagihanId: null,
        transaksiKasId: k.id,
        adminId: k.adminId,
      },
    });

    created++;
  }

  console.log("=== Sinkronisasi Biaya Selesai ===");
  console.log(`Ditemukan TransaksiKas PENGELUARAN tanpa Biaya: ${kasRows.length}`);
  console.log(`Dikonversi menjadi Biaya: ${created}`);
  console.log(`Dilewati (bukan beban): ${skipped}`);
  if (Object.keys(skipReasons).length > 0) {
    console.log("Detail penolakan:");
    for (const [reason, count] of Object.entries(skipReasons)) {
      console.log(`  - ${reason}: ${count}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
