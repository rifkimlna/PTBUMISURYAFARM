// Resolver tag -> akun COA untuk modul Anggaran Laba Rugi.
// Sumber data: TransaksiKas ber-tag (tag = penanda mutasi kas) + master AkunCOA.
// Akun "label kas" dicari dari kodeAkun transaksi dan dari nama akun yang sama
// dengan kategori transaksi, sehingga tetap benar bila kode COA diurutkan ulang.

import { prisma } from "@/lib/prisma";
import { isNonLabaRugiTag } from "@/lib/anggaran-tag";

/** Peta kode akun COA -> tag non-laba-rugi. */
export async function getTagAkunNonLabaRugi(): Promise<Map<string, string>> {
  const [trx, akun] = await Promise.all([
    prisma.transaksiKas.findMany({
      where: { tag: { not: null } },
      select: { tag: true, kodeAkun: true, kategori: true },
    }),
    prisma.akunCOA.findMany({ select: { kode: true, nama: true } }),
  ]);

  const kodeByNama = new Map(akun.map((a) => [a.nama.trim().toLowerCase(), a.kode]));
  const map = new Map<string, string>();
  for (const t of trx) {
    if (!isNonLabaRugiTag(t.tag)) continue;
    const tag = t.tag!.trim().toUpperCase();
    if (t.kodeAkun) map.set(t.kodeAkun, tag);
    const kodeDariKategori = kodeByNama.get(t.kategori.trim().toLowerCase());
    if (kodeDariKategori) map.set(kodeDariKategori, tag);
  }
  return map;
}
