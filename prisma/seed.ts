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

  await prisma.pohon.upsert({
    where: { id: "PHN-BLK-A01" },
    update: {},
    create: {
      id: "PHN-BLK-A01",
      varietas: "Sawit DxP",
      lokasiBlok: "Blok A",
      tanggalTanam: new Date("2024-01-15"),
      status: "SEHAT",
    },
  });

  await prisma.karyawan.upsert({
    where: { id: "EMP-001" },
    update: {},
    create: {
      id: "EMP-001",
      namaLengkap: "Joko Tani",
      jabatan: "Mandor",
      statusKerja: "TETAP",
      gajiPokok: 3500000 as any,
      tanggalMasuk: new Date("2023-01-10"),
    },
  });

  console.log("✅ Seed selesai. Login dengan password: Admin123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
