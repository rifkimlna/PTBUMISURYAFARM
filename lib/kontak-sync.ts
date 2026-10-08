import type { PrismaClient } from "../generated/prisma/client";

// Sinkron dua arah Kontak <-> Pelanggan / Supplier.
// Aturan:
// - Kunci pencocokan = nama (case-insensitive, trim). Tanpa FK agar modul
//   Penjualan / Pembelian yang sudah berjalan tidak terganggu.
// - Kontak adalah master terpadu; Pelanggan dipakai form Penjualan,
//   Supplier dipakai form Pembelian. Kedua sisi dibuat bila belum ada,
//   tidak pernah dihapus otomatis (dokumen lama merujuk nama tersebut).

export function normalNama(nama: string) {
  return nama.trim().toLowerCase();
}

type Tx = Pick<PrismaClient, "kontak" | "pelanggan" | "supplier" | "karyawan"> & {
  // $transaction client memiliki shape yang sama untuk model yang dipakai
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
};

// Pelanggan (dari Penjualan) -> pastikan ada Kontak PELANGGAN.
export async function ensureKontakForPelanggan(
  tx: Tx,
  p: { nama: string; email?: string | null; telepon?: string | null; alamat?: string | null }
) {
  const nama = p.nama.trim();
  if (!nama) return null;
  const existing = await tx.kontak.findFirst({
    where: { tipe: "PELANGGAN", nama: { equals: nama, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing;
  return tx.kontak.create({
    data: {
      nama,
      tipe: "PELANGGAN",
      email: p.email?.trim() || null,
      noHp: p.telepon?.trim() || null,
      noTelepon: null,
      alamat: p.alamat?.trim() || null,
      catatan: "Otomatis dari data Penjualan",
    },
    select: { id: true },
  });
}

// Supplier (dari Pembelian) -> pastikan ada Kontak SUPPLIER.
export async function ensureKontakForSupplier(
  tx: Tx,
  s: { nama: string; email?: string | null; telepon?: string | null; alamat?: string | null }
) {
  const nama = s.nama.trim();
  if (!nama) return null;
  const existing = await tx.kontak.findFirst({
    where: { tipe: "SUPPLIER", nama: { equals: nama, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing;
  return tx.kontak.create({
    data: {
      nama,
      tipe: "SUPPLIER",
      email: s.email?.trim() || null,
      noHp: s.telepon?.trim() || null,
      noTelepon: null,
      alamat: s.alamat?.trim() || null,
      catatan: "Otomatis dari data Pembelian",
    },
    select: { id: true },
  });
}

// Kontak PELANGGAN -> pastikan ada Pelanggan (agar muncul di dropdown Penjualan).
export async function ensurePelangganForKontak(
  tx: Tx,
  k: { nama: string; email?: string | null; noHp?: string | null; alamat?: string | null }
) {
  const nama = k.nama.trim();
  if (!nama) return null;
  const existing = await tx.pelanggan.findFirst({
    where: { nama: { equals: nama, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing;
  return tx.pelanggan.create({
    data: {
      nama,
      email: k.email?.trim() || null,
      telepon: k.noHp?.trim() || null,
      alamat: k.alamat?.trim() || null,
    },
    select: { id: true },
  });
}

// Kontak SUPPLIER -> pastikan ada Supplier (agar muncul di dropdown Pembelian).
export async function ensureSupplierForKontak(
  tx: Tx,
  k: { nama: string; email?: string | null; noHp?: string | null; alamat?: string | null }
) {
  const nama = k.nama.trim();
  if (!nama) return null;
  const existing = await tx.supplier.findFirst({
    where: { nama: { equals: nama, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing;
  return tx.supplier.create({
    data: {
      nama,
      email: k.email?.trim() || null,
      telepon: k.noHp?.trim() || null,
      alamat: k.alamat?.trim() || null,
    },
    select: { id: true },
  });
}

// Backfill satu arah untuk data lama: semua Pelanggan & Supplier yang belum
// punya pasangan Kontak dibuatkan Kontak. Mengembalikan jumlah yang dibuat.
// Idempoten: aman dijalankan berulang (tidak membuat duplikat).
export async function backfillKontak(prisma: Tx) {
  let pelangganBaru = 0;
  let supplierBaru = 0;

  const [semuaPelanggan, semuaSupplier] = await Promise.all([
    prisma.pelanggan.findMany({
      select: { nama: true, email: true, telepon: true, alamat: true },
    }),
    prisma.supplier.findMany({
      select: { nama: true, email: true, telepon: true, alamat: true },
    }),
  ]);

  for (const p of semuaPelanggan) {
    const ada = await prisma.kontak.findFirst({
      where: { tipe: "PELANGGAN", nama: { equals: p.nama.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (!ada) {
      await prisma.kontak.create({
        data: {
          nama: p.nama.trim(),
          tipe: "PELANGGAN",
          email: p.email?.trim() || null,
          noHp: p.telepon?.trim() || null,
          alamat: p.alamat?.trim() || null,
          catatan: "Otomatis dari data Penjualan",
        },
      });
      pelangganBaru += 1;
    }
  }

  for (const s of semuaSupplier) {
    const ada = await prisma.kontak.findFirst({
      where: { tipe: "SUPPLIER", nama: { equals: s.nama.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (!ada) {
      await prisma.kontak.create({
        data: {
          nama: s.nama.trim(),
          tipe: "SUPPLIER",
          email: s.email?.trim() || null,
          noHp: s.telepon?.trim() || null,
          alamat: s.alamat?.trim() || null,
          catatan: "Otomatis dari data Pembelian",
        },
      });
      supplierBaru += 1;
    }
  }

  return { pelangganBaru, supplierBaru };
}

// Backfill satu arah untuk data karyawan lama: setiap baris tabel Karyawan
// (arsip) dipastikan punya pasangan Kontak tipe KARYAWAN. Idempoten.
// - Cocok dulu via kodeKaryawan (= Karyawan.id lama); bila cocok -> lewati.
// - Bila belum ada kode tapi ada Kontak KARYAWAN se-nama -> tempelkan kode +
//   isi field karyawan yang masih kosong (tanpa menimpa isian manual).
// - Selain itu -> buat Kontak KARYAWAN baru dari data Karyawan.
export async function backfillKaryawan(prisma: Tx) {
  let karyawanBaru = 0;
  let karyawanDitautkan = 0;

  const semuaKaryawan = await prisma.karyawan.findMany({
    orderBy: { id: "asc" },
  });

  for (const k of semuaKaryawan) {
    const byKode = await prisma.kontak.findUnique({
      where: { kodeKaryawan: k.id },
      select: { id: true },
    });
    if (byKode) continue;

    const byNama = await prisma.kontak.findFirst({
      where: { tipe: "KARYAWAN", nama: { equals: k.namaLengkap.trim(), mode: "insensitive" } },
    });
    if (byNama) {
      await prisma.kontak.update({
        where: { id: byNama.id },
        data: {
          kodeKaryawan: k.id,
          jabatan: byNama.jabatan ?? k.jabatan,
          statusKerja: byNama.statusKerja ?? k.statusKerja,
          lokasiKerja: byNama.lokasiKerja ?? k.lokasiKerja,
          tanggalMasuk: byNama.tanggalMasuk ?? k.tanggalMasuk,
          gajiPokok: byNama.gajiPokok ?? k.gajiPokok,
          tanggalLahir: byNama.tanggalLahir ?? k.tanggalLahir,
          jenisKelamin: byNama.jenisKelamin ?? k.jenisKelamin,
          email: byNama.email ?? k.email,
          noHp: byNama.noHp ?? k.telepon,
          alamat: byNama.alamat ?? k.alamat,
        },
      });
      karyawanDitautkan += 1;
      continue;
    }

    await prisma.kontak.create({
      data: {
        nama: k.namaLengkap.trim(),
        tipe: "KARYAWAN",
        email: k.email?.trim() || null,
        noHp: k.telepon?.trim() || null,
        alamat: k.alamat?.trim() || null,
        catatan: "Migrasi dari Data Karyawan",
        kodeKaryawan: k.id,
        jabatan: k.jabatan,
        statusKerja: k.statusKerja,
        lokasiKerja: k.lokasiKerja,
        tanggalMasuk: k.tanggalMasuk,
        gajiPokok: k.gajiPokok,
        tanggalLahir: k.tanggalLahir,
        jenisKelamin: k.jenisKelamin,
      },
    });
    karyawanBaru += 1;
  }

  return { karyawanBaru, karyawanDitautkan };
}

// Nomor ID karyawan berikutnya (EMP-001, EMP-002, ...). Memindai kode yang
// sudah dipakai di Kontak maupun arsip Karyawan agar tidak tabrakan.
export async function generateKodeKaryawan(prisma: Tx): Promise<string> {
  const [kontak, arsip] = await Promise.all([
    prisma.kontak.findMany({
      where: { kodeKaryawan: { not: null } },
      select: { kodeKaryawan: true },
    }),
    prisma.karyawan.findMany({ select: { id: true } }),
  ]);
  let max = 0;
  const cek = (kode: string | null | undefined) => {
    const m = /^EMP-(\d{3,})$/.exec((kode ?? "").trim().toUpperCase());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  };
  for (const r of kontak) cek(r.kodeKaryawan);
  for (const r of arsip) cek(r.id);
  return `EMP-${String(max + 1).padStart(3, "0")}`;
}
