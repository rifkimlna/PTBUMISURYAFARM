// Chart of Accounts (COA) PT Bumi Surya Farm - Server-side DB utilities only
// This file is ONLY for Server Components and API routes

import { prisma } from "@/lib/prisma";
import type { AkunCOA, KelompokCOA, TipeAkunCOA } from "./coa-types";

export { KELOMPOK_URUTAN, TIPE_BY_KELOMPOK, GOLOGAN_BY_KELOMPOK, SUMBER_DANA_KODE_MAP } from "./coa-types";

// Fetch all active COA from DB
export async function getAllCOAFromDB(): Promise<AkunCOA[]> {
  try {
    const data = await prisma.akunCOA.findMany({
      where: { isActive: true },
      orderBy: [{ kelompok: "asc" }, { golongan: "asc" }, { kode: "asc" }],
      select: {
        kode: true,
        nama: true,
        kelompok: true,
        golongan: true,
        tipe: true,
        deskripsi: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, nama: true } },
      },
    });
    return data as AkunCOA[];
  } catch {
    return [];
  }
}

// Fetch COA from DB with filters
export async function getCOAFromDB(filters?: {
  kelompok?: KelompokCOA;
  isActive?: boolean;
  search?: string;
}): Promise<AkunCOA[]> {
  try {
    const where: any = {};
    if (filters?.kelompok) where.kelompok = filters.kelompok;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.OR = [
        { kode: { contains: filters.search, mode: "insensitive" } },
        { nama: { contains: filters.search, mode: "insensitive" } },
        { golongan: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const data = await prisma.akunCOA.findMany({
      where,
      orderBy: [{ kelompok: "asc" }, { golongan: "asc" }, { kode: "asc" }],
      select: {
        kode: true,
        nama: true,
        kelompok: true,
        golongan: true,
        tipe: true,
        deskripsi: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, nama: true } },
      },
    });
    return data as AkunCOA[];
  } catch {
    return [];
  }
}

// Get single akun by kode from DB
export async function getAkunByKodeFromDB(kode: string): Promise<AkunCOA | null> {
  try {
    const data = await prisma.akunCOA.findUnique({
      where: { kode },
      select: {
        kode: true,
        nama: true,
        kelompok: true,
        golongan: true,
        tipe: true,
        deskripsi: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, nama: true } },
      },
    });
    return data as AkunCOA | null;
  } catch {
    return null;
  }
}

// Group akun by kelompok then golongan (from DB)
export async function getAkunGroupedFromDB(): Promise<Record<KelompokCOA, Record<string, AkunCOA[]>>> {
  try {
    const data = await prisma.akunCOA.findMany({
      where: { isActive: true },
      orderBy: [{ kelompok: "asc" }, { golongan: "asc" }, { kode: "asc" }],
      select: {
        kode: true,
        nama: true,
        kelompok: true,
        golongan: true,
        tipe: true,
        deskripsi: true,
        isActive: true,
      },
    });

    const result: Record<string, Record<string, AkunCOA[]>> = {};
    for (const kelompok of ["Aset", "Kewajiban", "Modal", "Pendapatan", "Beban"] as const) {
      result[kelompok] = {};
    }
    for (const akun of data) {
      if (!result[akun.kelompok][akun.golongan]) {
        result[akun.kelompok][akun.golongan] = [];
      }
      result[akun.kelompok][akun.golongan].push(akun as AkunCOA);
    }
    return result as Record<"Aset" | "Kewajiban" | "Modal" | "Pendapatan" | "Beban", Record<string, AkunCOA[]>>;
  } catch {
    return {} as Record<"Aset" | "Kewajiban" | "Modal" | "Pendapatan" | "Beban", Record<string, AkunCOA[]>>;
  }
}