export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { BiayaContent } from "@/components/admin/biaya-content";

// Biaya tunai selalu memiliki transaksiKasId dan biaya hutang selalu memiliki
// tagihanId. Baris dengan keduanya null adalah sisa data yatim akibat transaksi
// kasnya sudah dihapus (FK ON DELETE SET NULL) — tidak boleh tampil/dihitung.
const BIAYA_TERHUBUNG: Prisma.BiayaWhereInput = {
  OR: [{ transaksiKasId: { not: null } }, { tagihanId: { not: null } }],
};

// Halaman Biaya PT BST.
// Menampilkan data gabungan dari model Biaya (tunai maupun hutang) serta
// TransaksiKas PENGELUARAN yang belum ditautkan ke Biaya (biaya tunai dari
// Kas & Bank yang belum ada baris Biayanya). Setiap pengeluaran dihitung
// tepat satu kali tanpa double counting.
export default async function BiayaPage() {
  const now = new Date();
  const awalBulan = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const awal30Hari = new Date(now);
  awal30Hari.setDate(awal30Hari.getDate() - 30);
  awal30Hari.setHours(0, 0, 0, 0);

  let dbError = false;
  let biayaKasIds: { transaksiKasId: string | null }[] = [];
  let linkedKasIds = new Set<string>();
  let bulanIni: any = { _sum: { jumlah: null }, _count: { id: 0 } };
  let tigaPuluhHari: any = { _sum: { jumlah: null }, _count: { id: 0 } };
  let belumBayar: any = { _sum: { sisa: null }, _count: { id: 0 } };
  let kasBulanIni: any = { _sum: { jumlah: null }, _count: { id: 0 } };
  let kasTigaPuluhHari: any = { _sum: { jumlah: null }, _count: { id: 0 } };
  let biayaRows: any[] = [];
  let kasRows: any[] = [];

  try {
    biayaKasIds = await prisma.biaya.findMany({
      where: { transaksiKasId: { not: null } },
      select: { transaksiKasId: true },
    });
    linkedKasIds = new Set(biayaKasIds.map((b) => b.transaksiKasId!).filter(Boolean));

    [
      bulanIni,
      tigaPuluhHari,
      belumBayar,
      kasBulanIni,
      kasTigaPuluhHari,
      biayaRows,
      kasRows,
    ] = await Promise.all([
      prisma.biaya.aggregate({
        where: {
          tanggal: { gte: awalBulan },
          AND: [
            BIAYA_TERHUBUNG,
            {
              OR: [
                { transaksiKasId: null },
                { transaksiKas: { OR: [ { tag: null }, { tag: { notIn: ["BAYAR_UTANG", "BELI_ASET"] } } ] } },
              ],
            },
          ],
        },
        _sum: { jumlah: true },
        _count: { id: true },
      }),
      prisma.biaya.aggregate({
        where: {
          tanggal: { gte: awal30Hari },
          AND: [
            BIAYA_TERHUBUNG,
            {
              OR: [
                { transaksiKasId: null },
                { transaksiKas: { OR: [ { tag: null }, { tag: { notIn: ["BAYAR_UTANG", "BELI_ASET"] } } ] } },
              ],
            },
          ],
        },
        _sum: { jumlah: true },
        _count: { id: true },
      }),
      prisma.biaya.aggregate({
        where: {
          status: { not: "LUNAS" },
          AND: [
            BIAYA_TERHUBUNG,
            {
              OR: [
                { transaksiKasId: null },
                { transaksiKas: { OR: [ { tag: null }, { tag: { notIn: ["BAYAR_UTANG", "BELI_ASET"] } } ] } },
              ],
            },
          ],
        },
        _sum: { sisa: true },
        _count: { id: true },
      }),
      prisma.transaksiKas.aggregate({
        where: {
          tipe: "PENGELUARAN",
          tanggal: { gte: awalBulan },
          id: { notIn: [...linkedKasIds] },
          OR: [
            { tag: null },
            { tag: { notIn: ["BAYAR_UTANG", "BELI_ASET"] } },
          ],
        },
        _sum: { jumlah: true },
        _count: { id: true },
      }),
      prisma.transaksiKas.aggregate({
        where: {
          tipe: "PENGELUARAN",
          tanggal: { gte: awal30Hari },
          id: { notIn: [...linkedKasIds] },
          OR: [
            { tag: null },
            { tag: { notIn: ["BAYAR_UTANG", "BELI_ASET"] } },
          ],
        },
        _sum: { jumlah: true },
        _count: { id: true },
      }),
      prisma.biaya.findMany({
        where: {
          AND: [
            BIAYA_TERHUBUNG,
            {
              OR: [
                { transaksiKasId: null },
                { transaksiKas: { OR: [ { tag: null }, { tag: { notIn: ["BAYAR_UTANG", "BELI_ASET"] } } ] } },
              ],
            },
          ],
        },
        orderBy: { tanggal: "desc" },
        take: 100,
        select: {
          id: true,
          noBiaya: true,
          tanggal: true,
          kategori: true,
          kodeAkun: true,
          penerima: true,
          status: true,
          sisa: true,
          jumlah: true,
          tags: true,
          memo: true,
          tagihanId: true,
          transaksiKas: { select: { sumberDana: true } },
        },
      }),
      prisma.transaksiKas.findMany({
        where: {
          tipe: "PENGELUARAN",
          id: { notIn: [...linkedKasIds] },
          OR: [
            { tag: null },
            { tag: { notIn: ["BAYAR_UTANG", "BELI_ASET"] } },
          ],
        },
        orderBy: { tanggal: "desc" },
        take: 100,
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
          tagihanId: true,
        },
      }),
    ]);
  } catch (e) {
    console.error("[keuangan/biaya] database tidak terjangkau:", e instanceof Error ? e.message : e);
    dbError = true;
  }

  return (
    <div className="space-y-6">
      {dbError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-sm font-medium text-red-800">⚠️ Database tidak terhubung — data biaya mungkin kosong.</div>
          <div className="mt-1 text-xs text-red-600">Cek DATABASE_URL di Vercel Environment Variables lalu redeploy.</div>
        </div>
      )}
      <BiayaContent
        summary={{
          bulanIni: Number(bulanIni._sum.jumlah ?? 0) + Number(kasBulanIni._sum.jumlah ?? 0),
          bulanIniCount: bulanIni._count.id + kasBulanIni._count.id,
          tigaPuluhHari: Number(tigaPuluhHari._sum.jumlah ?? 0) + Number(kasTigaPuluhHari._sum.jumlah ?? 0),
          tigaPuluhHariCount: tigaPuluhHari._count.id + kasTigaPuluhHari._count.id,
          belumDibayar: Number(belumBayar._sum.sisa ?? 0),
          belumDibayarCount: belumBayar._count.id,
        }}
        rows={[
          ...biayaRows.map((b) => ({
            id: b.id,
            tanggal: b.tanggal.toISOString(),
            nomor: b.noBiaya,
            kategori: b.kodeAkun ? `${b.kodeAkun} - ${b.kategori}` : b.kategori,
            penerima: b.penerima,
            status: b.status as "BELUM_LUNAS" | "LUNAS_SEBAGIAN" | "LUNAS",
            sisa: Number(b.sisa),
            total: Number(b.jumlah),
            tags: b.tags,
            sumber: (b.tagihanId ? "HUTANG" : "TUNAI") as "TUNAI" | "HUTANG",
            keterangan: b.memo,
            sumberDana: b.transaksiKas?.sumberDana ?? null,
          })),
          ...kasRows.map((k) => ({
            id: k.id,
            tanggal: k.tanggal.toISOString(),
            nomor: k.noTransaksi ?? "-",
            kategori: k.kodeAkun ? `${k.kodeAkun} - ${k.kategori}` : k.kategori,
            penerima: k.pihak ?? "-",
            status: "LUNAS" as const,
            sisa: 0,
            total: Number(k.jumlah),
            tags: null,
            sumber: "KAS" as const,
            keterangan: k.keterangan,
            sumberDana: k.sumberDana,
          })),
        ]}
      />
    </div>
  );
}
