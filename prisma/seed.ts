import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding PT BST...");

  const hash = await bcrypt.hash("Admin123!", 10);

  const users = [
    { nama: "Super Admin", email: "super@ptbst.id", password: hash, role: "SUPER_ADMIN" as const },
    { nama: "Budi Pertanian", email: "budi@ptbst.id", password: hash, role: "ADMIN_PERTANIAN" as const },
    { nama: "Siti Keuangan", email: "siti@ptbst.id", password: hash, role: "ADMIN_KEUANGAN" as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  const adminKeuangan = await prisma.user.findUniqueOrThrow({
    where: { email: "siti@ptbst.id" },
    select: { id: true },
  });

  await prisma.pohon.upsert({
    where: { id: "PHN-BLK-A01" },
    update: {
      namaPohon: "Pohon Sawit Induk A01",
      jenis: "Sawit DxP",
      koordinat: "-2.983, 104.752",
      hasilPanen: 125.5 as any,
      pemupukan: "NPK 2kg - 2026-01-15",
      pengobatan: "Fungisida 2ml/L - Sehat",
    },
    create: {
      id: "PHN-BLK-A01",
      namaPohon: "Pohon Sawit Induk A01",
      varietas: "Sawit DxP",
      jenis: "Sawit DxP",
      lokasiBlok: "Blok A",
      tanggalTanam: new Date("2024-01-15"),
      koordinat: "-2.983, 104.752",
      hasilPanen: 125.5 as any,
      pemupukan: "NPK 2kg - 2026-01-15",
      pengobatan: "Fungisida 2ml/L - Sehat",
      status: "SEHAT",
    },
  });

  // Data contoh tambahan untuk 11 field demo
  await prisma.pohon.upsert({
    where: { id: "PHN-BLK-A02" },
    update: {
      namaPohon: "Pohon Sawit A02",
      jenis: "Sawit DxP",
      koordinat: "-2.984, 104.753",
      hasilPanen: 98.0 as any,
      pemupukan: "Urea 1.5kg - 2026-02-10",
      pengobatan: "Insektisida - Perlu Perhatian",
    },
    create: {
      id: "PHN-BLK-A02",
      namaPohon: "Pohon Sawit A02",
      varietas: "Sawit DxP",
      jenis: "Sawit DxP",
      lokasiBlok: "Blok A",
      tanggalTanam: new Date("2023-06-10"),
      koordinat: "-2.984, 104.753",
      hasilPanen: 98.0 as any,
      pemupukan: "Urea 1.5kg - 2026-02-10",
      pengobatan: "Insektisida - Perlu Perhatian",
      status: "PERLU_PERHATIAN",
    },
  });

  await prisma.pohon.upsert({
    where: { id: "PHN-BLK-B01" },
    update: {
      namaPohon: "Pohon Durian B01",
      jenis: "Durian Montong",
      koordinat: "-2.990, 104.760",
      hasilPanen: 45.2 as any,
      pemupukan: "Kompos 3kg - 2026-03-01",
      pengobatan: "Pestisida - Sakit ringan",
    },
    create: {
      id: "PHN-BLK-B01",
      namaPohon: "Pohon Durian B01",
      varietas: "Durian Montong",
      jenis: "Durian Montong",
      lokasiBlok: "Blok B",
      tanggalTanam: new Date("2022-11-20"),
      koordinat: "-2.990, 104.760",
      hasilPanen: 45.2 as any,
      pemupukan: "Kompos 3kg - 2026-03-01",
      pengobatan: "Pestisida - Sakit ringan",
      status: "SAKIT",
    },
  });

  await prisma.pohon.upsert({
    where: { id: "PHN-BLK-C01" },
    update: {
      namaPohon: "Pohon Sawit C01",
      jenis: "Sawit DxP",
      koordinat: "-2.995, 104.765",
      hasilPanen: 60.0 as any,
      pemupukan: "NPK 2kg - 2026-03-10",
      pengobatan: "Pemantauan rutin - Sehat",
    },
    create: {
      id: "PHN-BLK-C01",
      namaPohon: "Pohon Sawit C01",
      varietas: "Sawit DxP",
      jenis: "Sawit DxP",
      lokasiBlok: "Blok C",
      tanggalTanam: new Date("2024-03-05"),
      koordinat: "-2.995, 104.765",
      hasilPanen: 60.0 as any,
      pemupukan: "NPK 2kg - 2026-03-10",
      pengobatan: "Pemantauan rutin - Sehat",
      status: "SEHAT",
    },
  });

  await prisma.karyawan.upsert({
    where: { id: "EMP-001" },
    update: {
      telepon: "081234567890",
      email: "joko.tani@ptbst.id",
      alamat: "Perumahan Bumi Surya, Blok A",
      tanggalLahir: new Date("1985-06-15"),
      jenisKelamin: "LAKI_LAKI",
      divisi: "Operasional Kebun",
      lokasiKerja: "Blok A",
    },
    create: {
      id: "EMP-001",
      namaLengkap: "Joko Tani",
      jabatan: "Mandor",
      statusKerja: "TETAP",
      gajiPokok: 3500000,
      tanggalMasuk: new Date("2023-01-10"),
      telepon: "081234567890",
      email: "joko.tani@ptbst.id",
      alamat: "Perumahan Bumi Surya, Blok A",
      tanggalLahir: new Date("1985-06-15"),
      jenisKelamin: "LAKI_LAKI",
      divisi: "Operasional Kebun",
      lokasiKerja: "Blok A",
    },
  });

  await prisma.riwayatGaji.upsert({
    where: { karyawanId_bulanTahun: { karyawanId: "EMP-001", bulanTahun: "2026-08" } },
    update: {
      totalGaji: 3500000,
      status: "SUDAH_DIBAYAR",
      tanggalBayar: new Date("2026-08-31"),
    },
    create: {
      karyawanId: "EMP-001",
      bulanTahun: "2026-08",
      totalGaji: 3500000,
      status: "SUDAH_DIBAYAR",
      tanggalBayar: new Date("2026-08-31"),
    },
  });

  await prisma.transaksiKas.deleteMany({ where: { id: { startsWith: "SEED-" } } });
  await prisma.transaksiKas.createMany({
    data: [
      {
        id: "SEED-TRX-001",
        adminId: adminKeuangan.id,
        tipe: "PEMASUKAN",
        kategori: "Penjualan Sawit",
        jumlah: 5000000,
        keterangan: "Panen sawit Blok A",
        tanggal: new Date("2026-08-05"),
      },
      {
        id: "SEED-TRX-002",
        adminId: adminKeuangan.id,
        tipe: "PEMASUKAN",
        kategori: "Penjualan Durian",
        jumlah: 2500000,
        keterangan: "Panen durian Blok B",
        tanggal: new Date("2026-08-12"),
      },
      {
        id: "SEED-TRX-003",
        adminId: adminKeuangan.id,
        tipe: "PENGELUARAN",
        kategori: "Pembayaran Gaji Karyawan",
        jumlah: 3500000,
        keterangan: "Gaji karyawan bulan Agustus 2026",
        tanggal: new Date("2026-08-31"),
      },
    ],
  });

  const daftarAset = [
    { id: "AST-001", namaAset: "Truk Pengangkut Sawit", jumlah: 1, kondisi: "Baik", nilaiAset: 250000000 },
    { id: "AST-002", namaAset: "Mesin Genset", jumlah: 1, kondisi: "Baik", nilaiAset: 35000000 },
    { id: "AST-003", namaAset: "Traktor", jumlah: 1, kondisi: "Baik", nilaiAset: 180000000 },
    { id: "AST-004", namaAset: "Gudang Penyimpanan", jumlah: 1, kondisi: "Baik", nilaiAset: 90000000 },
  ];
  for (const aset of daftarAset) {
    const { id, ...payload } = aset;
    await prisma.aset.upsert({
      where: { id },
      update: payload,
      create: { id, ...payload },
    });
  }

  console.log("✅ Seed selesai. Login dengan password: Admin123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());