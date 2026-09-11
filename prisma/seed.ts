import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding PT BST...");

  const hash = await bcrypt.hash("Admin123!", 10);
  const hashPetugas = await bcrypt.hash("Lapangan123!", 10);

  const users = [
    { nama: "Super Admin", email: "super@ptbst.id", password: hash, role: "SUPER_ADMIN" as const },
    { nama: "Budi Pertanian", email: "budi@ptbst.id", password: hash, role: "ADMIN_PERTANIAN" as const },
    { nama: "Siti Keuangan", email: "siti@ptbst.id", password: hash, role: "ADMIN_KEUANGAN" as const },
    { nama: "Petugas Lapangan", email: "petugas@ptbst.id", password: hashPetugas, role: "PETUGAS_LAPANGAN" as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  const budi = await prisma.user.findUnique({ where: { email: "budi@ptbst.id" } });
  const adminKeuangan = await prisma.user.findUniqueOrThrow({
    where: { email: "siti@ptbst.id" },
    select: { id: true },
  });

  await prisma.pohon.upsert({
    where: { id: "PHN-BLK-A01" },
    update: {
      namaPohon: "Pohon Sawit Induk A01",
      jenis: "Sawit DxP",
      lokasiBlok: "Blok A",
      koordinat: "-2.983, 104.752",
      hasilPanen: 125.5 as any,
      pemupukan: "NPK 2kg - 2026-01-15",
      pengobatan: "Fungisida 2ml/L - Sehat",
      fotoGeotagUrl: "https://picsum.photos/seed/phn-a01/600/400",
      latitude: -2.983,
      longitude: 104.752,
      geotagAccuracy: 12,
      geotagSource: "GPS",
      geotagTimestamp: new Date("2026-09-09T08:00:00Z"),
      geotagAdminId: budi?.id,
      status: "SEHAT",
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
      fotoGeotagUrl: "https://picsum.photos/seed/phn-a01/600/400",
      latitude: -2.983,
      longitude: 104.752,
      geotagAccuracy: 12,
      geotagSource: "GPS",
      geotagTimestamp: new Date("2026-09-09T08:00:00Z"),
      geotagAdminId: budi?.id,
      status: "SEHAT",
    },
  });

  // Data contoh tambahan untuk 11 field demo
  await prisma.pohon.upsert({
    where: { id: "PHN-BLK-A02" },
    update: {
      namaPohon: "Pohon Sawit A02",
      jenis: "Sawit DxP",
      lokasiBlok: "Blok A",
      koordinat: "-2.984, 104.753",
      hasilPanen: 98.0 as any,
      pemupukan: "Urea 1.5kg - 2026-02-10",
      pengobatan: "Insektisida - Perlu Perhatian",
      fotoGeotagUrl: "https://picsum.photos/seed/phn-a02/600/400",
      latitude: -2.984,
      longitude: 104.753,
      geotagAccuracy: 18,
      geotagSource: "GPS",
      geotagTimestamp: new Date("2026-09-08T08:00:00Z"),
      geotagAdminId: budi?.id,
      status: "PERLU_PERHATIAN",
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
      fotoGeotagUrl: "https://picsum.photos/seed/phn-a02/600/400",
      latitude: -2.984,
      longitude: 104.753,
      geotagAccuracy: 18,
      geotagSource: "GPS",
      geotagTimestamp: new Date("2026-09-08T08:00:00Z"),
      geotagAdminId: budi?.id,
      status: "PERLU_PERHATIAN",
    },
  });

  await prisma.pohon.upsert({
    where: { id: "PHN-BLK-B01" },
    update: {
      namaPohon: "Pohon Durian B01",
      jenis: "Durian Montong",
      lokasiBlok: "Blok B",
      koordinat: "-2.990, 104.760",
      hasilPanen: 45.2 as any,
      pemupukan: "Kompos 3kg - 2026-03-01",
      pengobatan: "Pestisida - Sakit ringan",
      fotoGeotagUrl: "https://picsum.photos/seed/phn-b01/600/400",
      latitude: -2.99,
      longitude: 104.76,
      geotagAccuracy: 25,
      geotagSource: "MANUAL",
      geotagTimestamp: new Date("2026-09-07T08:00:00Z"),
      geotagAdminId: budi?.id,
      status: "SAKIT",
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
      fotoGeotagUrl: "https://picsum.photos/seed/phn-b01/600/400",
      latitude: -2.99,
      longitude: 104.76,
      geotagAccuracy: 25,
      geotagSource: "MANUAL",
      geotagTimestamp: new Date("2026-09-07T08:00:00Z"),
      geotagAdminId: budi?.id,
      status: "SAKIT",
    },
  });

  await prisma.pohon.upsert({
    where: { id: "PHN-BLK-C01" },
    update: {
      namaPohon: "Pohon Sawit C01",
      jenis: "Sawit DxP",
      lokasiBlok: "Blok C",
      koordinat: "-2.995, 104.765",
      hasilPanen: 60.0 as any,
      pemupukan: "NPK 2kg - 2026-03-10",
      pengobatan: "Pemantauan rutin - Sehat",
      fotoGeotagUrl: "https://picsum.photos/seed/phn-c01/600/400",
      latitude: -2.995,
      longitude: 104.765,
      geotagAccuracy: 15,
      geotagSource: "GPS",
      geotagTimestamp: new Date("2026-09-06T08:00:00Z"),
      geotagAdminId: budi?.id,
      status: "SEHAT",
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
      fotoGeotagUrl: "https://picsum.photos/seed/phn-c01/600/400",
      latitude: -2.995,
      longitude: 104.765,
      geotagAccuracy: 15,
      geotagSource: "GPS",
      geotagTimestamp: new Date("2026-09-06T08:00:00Z"),
      geotagAdminId: budi?.id,
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
        kategori: "Pendapatan Penjualan Hasil Kebun",
        kodeAkun: "4101",
        sumberDana: "KAS",
        jumlah: 5000000,
        keterangan: "Panen sawit Blok A",
        tanggal: new Date("2026-08-05"),
      },
      {
        id: "SEED-TRX-002",
        adminId: adminKeuangan.id,
        tipe: "PEMASUKAN",
        kategori: "Pendapatan Penjualan Hasil Kebun",
        kodeAkun: "4101",
        sumberDana: "BANK",
        jumlah: 2500000,
        keterangan: "Panen durian Blok B",
        tanggal: new Date("2026-08-12"),
      },
      {
        id: "SEED-TRX-003",
        adminId: adminKeuangan.id,
        tipe: "PENGELUARAN",
        kategori: "Beban Upah dan Gaji Pekerja",
        kodeAkun: "5101",
        sumberDana: "KAS",
        jumlah: 3500000,
        keterangan: "Gaji karyawan bulan Agustus 2026",
        tanggal: new Date("2026-08-31"),
      },
    ],
  });

const daftarAset = [
  { id: "AST-001", namaAset: "Truk Pengangkut Sawit", jumlah: 1, kategori: "Mesin & Peralatan Pertanian/Peternakan", kondisi: "Baik", status: "Aktif", nilaiAset: 250000000, tanggalPerolehan: new Date("2026-01-15") },
  { id: "AST-002", namaAset: "Mesin Genset", jumlah: 1, kategori: "Mesin & Peralatan Pertanian/Peternakan", kondisi: "Baik", status: "Aktif", nilaiAset: 35000000, tanggalPerolehan: new Date("2026-02-01") },
  { id: "AST-003", namaAset: "Traktor", jumlah: 1, kategori: "Mesin & Peralatan Pertanian/Peternakan", kondisi: "Baik", status: "Aktif", nilaiAset: 180000000, tanggalPerolehan: new Date("2026-01-20") },
  { id: "AST-004", namaAset: "Gudang Penyimpanan", jumlah: 1, kategori: "Bangunan & Instalasi", kondisi: "Baik", status: "Aktif", nilaiAset: 90000000, tanggalPerolehan: new Date("2025-12-10") },
  { id: "AST-005", namaAset: "Kursi", jumlah: 1, kategori: "Perabotan & Peralatan Kantor/Villa", kondisi: "Rusak Ringan", status: "Tidak Digunakan", nilaiAset: 2300000, tanggalPerolehan: new Date("2026-09-09") },
];
  for (const aset of daftarAset) {
    const { id, ...payload } = aset;
    await prisma.aset.upsert({
      where: { id },
      update: payload,
      create: { id, ...payload },
    });
  }

  // Seed Panen histori untuk chart trend (6 bulan terakhir)
  const budiId = budi?.id ?? null;
  const panenData = [
    { pohonId: "PHN-BLK-A01", tanggalPanen: new Date("2026-04-10"), jumlahKg: 110 as any, petugasId: budiId, catatan: "Panen April" },
    { pohonId: "PHN-BLK-A01", tanggalPanen: new Date("2026-05-12"), jumlahKg: 118 as any, petugasId: budiId, catatan: "Panen Mei" },
    { pohonId: "PHN-BLK-A01", tanggalPanen: new Date("2026-06-15"), jumlahKg: 122 as any, petugasId: budiId, catatan: "Panen Juni" },
    { pohonId: "PHN-BLK-A01", tanggalPanen: new Date("2026-07-10"), jumlahKg: 130 as any, petugasId: budiId, catatan: "Panen Juli" },
    { pohonId: "PHN-BLK-A01", tanggalPanen: new Date("2026-08-10"), jumlahKg: 125.5 as any, petugasId: budiId, catatan: "Panen Agustus" },
    { pohonId: "PHN-BLK-A02", tanggalPanen: new Date("2026-06-20"), jumlahKg: 92 as any, petugasId: budiId, catatan: "Panen Juni" },
    { pohonId: "PHN-BLK-A02", tanggalPanen: new Date("2026-08-08"), jumlahKg: 98 as any, petugasId: budiId, catatan: "Panen Agustus" },
    { pohonId: "PHN-BLK-B01", tanggalPanen: new Date("2026-07-05"), jumlahKg: 40 as any, petugasId: budiId, catatan: "Panen Juli" },
    { pohonId: "PHN-BLK-B01", tanggalPanen: new Date("2026-08-07"), jumlahKg: 45.2 as any, petugasId: budiId, catatan: "Panen Agustus" },
    { pohonId: "PHN-BLK-C01", tanggalPanen: new Date("2026-08-06"), jumlahKg: 60 as any, petugasId: budiId, catatan: "Panen Agustus" },
  ];
  for (const p of panenData) {
    const exists = await prisma.panen.findFirst({ where: { pohonId: p.pohonId, tanggalPanen: p.tanggalPanen } });
    if (!exists) await prisma.panen.create({ data: p });
  }

  console.log("✅ Seed selesai. Login dengan password: Admin123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());