import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const data = [
  {
    judul: "Admin Keuangan",
    divisi: "Keuangan",
    lokasi: "Kantor Kebun",
    tipe: "KERJA" as const,
    deskripsi: "Mengelola pembukuan kas, faktur, dan laporan keuangan bulanan perkebunan.",
    kualifikasi: "Pendidikan D3/S1 Akuntansi\nMahir Excel & software akuntansi\nTeliti dan jujur",
    deadline: new Date("2026-11-30"),
  },
  {
    judul: "Petugas Lapangan Pohon",
    divisi: "Operasional",
    lokasi: "Blok A-D",
    tipe: "KERJA" as const,
    deskripsi: "Pendataan pohon, input kesehatan pohon via scan QR, dan pelaporan panen harian.",
    kualifikasi: "SMA/SMK sederajat\nMau bekerja di lapangan\nMenguasai smartphone",
    deadline: new Date("2026-11-15"),
  },
  {
    judul: "Magang Digital Marketing",
    divisi: "Pemasaran",
    lokasi: "Kantor Kebun",
    tipe: "MAGANG" as const,
    deskripsi: "Membantu konten media sosial, dokumentasi kebun, dan katalog produk durian, alpukat, dan jambu.",
    kualifikasi: "Mahasiswa tingkat akhir / fresh graduate\nSuka konten & foto/video\nDurasi 3-6 bulan",
    deadline: new Date("2026-12-15"),
  },
];

async function main() {
  for (const d of data) {
    const existing = await prisma.lowongan.findFirst({ where: { judul: d.judul } });
    if (!existing) await prisma.lowongan.create({ data: d });
  }
  console.log("Seed lowongan selesai:", await prisma.lowongan.count());
}

main().finally(() => prisma.$disconnect());
