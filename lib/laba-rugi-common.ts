import { prisma } from "@/lib/prisma";
import { DOKUMEN_PENJUALAN_STATUS_SAH } from "@/lib/piutang-rules";
import { getHppMutasiStok } from "@/lib/hpp-stok-server";

const num = (v: unknown) => Number(v ?? 0);

function isPendapatan(kodeAkun: string | null | undefined): boolean {
  if (!kodeAkun) return false;
  if (kodeAkun.startsWith("31")) return false;
  return kodeAkun.startsWith("4");
}

function isTerimaPiutang(t: { tag?: string | null; kategori?: string | null }): boolean {
  if (t.tag === "TERIMA_PIUTANG") return true;
  if (t.kategori?.trim().toLowerCase() === "penerimaan piutang usaha") return true;
  return false;
}

// Pelunasan utang bukan beban: kurangi kas/bank dan kewajiban (2101).
// Penanda utama relasi tagihan HUTANG; tag BAYAR_UTANG, golongan akun
// "Pelunasan Hutang", dan kategori pelunasan dipakai untuk data lama.
function isPelunasanUtang(
  t: { tag?: string | null; kategori?: string | null; tagihan?: { tipe?: string | null } | null },
  golongan?: string | null
): boolean {
  if (t.tag === "BAYAR_UTANG") return true;
  if (t.tagihan?.tipe === "HUTANG") return true;
  if (golongan === "Pelunasan Hutang") return true;
  const kategori = t.kategori?.trim().toLowerCase();
  return (
    kategori === "pelunasan hutang usaha" ||
    kategori === "pelunasan utang usaha" ||
    kategori === "pembayaran utang" ||
    kategori === "bayar utang"
  );
}

function isHpp(kodeAkun: string | null | undefined, golongan: string | undefined): boolean {
  if (!kodeAkun) return false;
  if (!kodeAkun.startsWith("52")) return false;
  return golongan === "Beban Produksi";
}

function isBebanNonHpp(kodeAkun: string | null | undefined): boolean {
  if (!kodeAkun) return false;
  if (!kodeAkun.startsWith("5")) return false;
  if (kodeAkun.startsWith("52")) return false;
  return true;
}

export async function getLabaRugi(start: Date, end: Date) {
  const [akunDb, dokumenPenjualan, transaksiKas, fakturPembelianItems, hppMutasi] = await Promise.all([
    prisma.akunCOA.findMany({ where: { isActive: true }, select: { kode: true, nama: true, golongan: true } }),
    prisma.dokumenPenjualan.findMany({
      where: { tipe: "PENAGIHAN", status: { in: [...DOKUMEN_PENJUALAN_STATUS_SAH] }, tanggal: { gte: start, lte: end } },
      select: { total: true },
    }),
    prisma.transaksiKas.findMany({
      where: { tanggal: { gte: start, lte: end } },
      select: {
        tipe: true,
        kodeAkun: true,
        jumlah: true,
        tag: true,
        kategori: true,
        tagihan: { select: { tipe: true } },
      },
    }),
    prisma.fakturPembelianItem.findMany({
      where: { faktur: { tanggal: { gte: start, lte: end } }, kodeAkun: { startsWith: "5" } },
      select: { jumlah: true, kodeAkun: true, deskripsi: true },
    }),
    getHppMutasiStok(start, end),
  ]);

  const akunMap = new Map(akunDb.map(a => [a.kode, { nama: a.nama, golongan: a.golongan }]));

  const pendapatanFaktur = dokumenPenjualan.reduce((s, d) => s + num(d.total), 0);
  const bebanFakturPembelian = fakturPembelianItems.reduce((s, i) => s + num(i.jumlah), 0);

  let totalPendapatan = pendapatanFaktur;
  const totalHpp = hppMutasi.totalHpp;
  let totalBeban = bebanFakturPembelian;

  const missingHppItems = hppMutasi.missingHppItems;

  const pendapatanDetails = new Map<string, { nama: string; nilai: number }>();
  const bebanDetails = new Map<string, { nama: string; nilai: number }>();

  // Pendapatan dari kas pemasukan
  for (const t of transaksiKas) {
    const jumlah = num(t.jumlah);
    if (t.tipe === "PEMASUKAN" && isPendapatan(t.kodeAkun) && !isTerimaPiutang(t)) {
      totalPendapatan += jumlah;
      const kode = t.kodeAkun ?? "";
      const nama = akunMap.get(kode)?.nama ?? t.kategori ?? kode;
      const pCur = pendapatanDetails.get(kode) ?? { nama, nilai: 0 };
      pCur.nilai += jumlah;
      pendapatanDetails.set(kode, pCur);
    } else if (t.tipe === "PENGELUARAN") {
      const gol = akunMap.get(t.kodeAkun ?? "")?.golongan;
      // Pelunasan utang mengurangi kas + kewajiban, bukan beban Laba Rugi.
      // Deteksi lewat relasi tagihan HUTANG (tag bisa null), tag BAYAR_UTANG,
      // atau golongan akun 5501 Pelunasan Hutang.
      if (isPelunasanUtang(t, gol)) continue;
      // HPP tidak lagi dari kas, kini dari stok penjualan
      if (isBebanNonHpp(t.kodeAkun)) {
        totalBeban += jumlah;
        const kode = t.kodeAkun ?? "";
        const nama = akunMap.get(kode)?.nama ?? t.kategori ?? kode;
        const cur = bebanDetails.get(kode) ?? { nama, nilai: 0 };
        cur.nilai += jumlah;
        bebanDetails.set(kode, cur);
      }
    }
  }

  // Beban dari faktur pembelian
  for (const i of fakturPembelianItems) {
    const jumlah = num(i.jumlah);
    const kode = i.kodeAkun ?? "";
    const namaBase = akunMap.get(kode)?.nama ?? i.deskripsi ?? kode;
    const key = kode;
    const nama = namaBase;
    const cur = bebanDetails.get(key) ?? { nama, nilai: 0 };
    cur.nilai += jumlah;
    bebanDetails.set(key, cur);
  }

  const labaBersih = totalPendapatan - totalHpp - totalBeban;
  return { totalPendapatan, totalHpp, totalBeban, labaBersih, pendapatanDetails, bebanDetails, missingHppItems };
}
