// Service Laporan Ringkasan Aset Tetap (KHUSUS modul laporan ini).
// JANGAN diimpor dari Client Component - hanya Server Component & API route.
//
// Sumber data: master Aset asli di database. Tidak ada data dummy.
// - Laporan adalah posisi pada tanggal akhir periode (tanggal awal hanya
//   menetapkan rentang/label laporan, bukan membatasi umur aset).
// - Aset TERTUNDA tidak dihitung.
// - Aset DIJUAL/DILEPAS dihitung hanya bila tanggal lepasnya setelah tanggal
//   akhir laporan (pada tanggal laporan aset tersebut masih aktif). Bila
//   tanggal lepas kosong, aset dianggap sudah tidak aktif.
// - Aset yang tanggal akuisisinya setelah tanggal akhir laporan tidak dihitung.
// - Penyusutan memakai hitungSusut() yang sama dengan halaman Aset (metode,
//   masa manfaat, nilai residu, tanggal mulai susut). Non-depresiasi = 0.
// - Tidak membuat jurnal otomatis dan tidak mengubah data transaksi.

import { prisma } from "@/lib/prisma";
import { getAkunByKode } from "@/lib/coa";
import { hitungSusut } from "@/lib/aset";
import type {
  RingkasanAsetBaris,
  RingkasanAsetKelompok,
  RingkasanAsetPeriode,
  RingkasanAsetSnapshot,
} from "@/lib/ringkasan-aset-types";

export {
  RINGKASAN_ASET_PERIODE,
  RINGKASAN_ASET_PERIODE_LABEL,
  resolveRingkasanAsetPeriode,
} from "@/lib/ringkasan-aset-types";
export type {
  RingkasanAsetBaris,
  RingkasanAsetKelompok,
  RingkasanAsetPeriode,
  RingkasanAsetSnapshot,
} from "@/lib/ringkasan-aset-types";

// Pemetaan fallback bila aset lama belum menyimpan akunAset.
const KODE_ASET_BY_KATEGORI: Record<string, string> = {
  Tanah: "1201",
  "Bangunan & Instalasi": "1202",
  "Bangunan dan Instalasi": "1202",
  "Mesin & Peralatan Pertanian/Peternakan": "1203",
  "Mesin dan Peralatan Pertanian/Peternakan": "1203",
  "Perabotan & Peralatan Kantor/Villa": "1204",
  "Perabotan dan Peralatan Kantor/Villa": "1204",
  "Tanaman Produktif": "1205",
  Ternak: "1206",
  "Ikan Budidaya": "1207",
};

function rupiah(v: unknown): number {
  return Math.round(Number(v ?? 0));
}

function isAktifPadaTanggal(
  a: {
    statusAset: string;
    tanggalAkuisisi: Date | null;
    tanggalPerolehan: Date | null;
    tanggalLepas: Date | null;
  },
  akhir: Date
): boolean {
  const status = (a.statusAset ?? "").trim().toUpperCase();
  if (status === "TERTUNDA") return false;

  if (status === "DIJUAL" || status === "DILEPAS") {
    // Tanpa tanggal lepas, status terjual/lepas dianggap sudah terjadi.
    if (!a.tanggalLepas) return false;
    // Dilepas pada/sebelum tanggal laporan -> bukan aset aktif pada tanggal itu.
    if (new Date(a.tanggalLepas).getTime() <= akhir.getTime()) return false;
  }

  const tanggal = a.tanggalAkuisisi ?? a.tanggalPerolehan;
  if (tanggal && new Date(tanggal).getTime() > akhir.getTime()) return false;

  return true;
}

export async function getRingkasanAsetSnapshot(
  dari: Date,
  sampai: Date,
  periode: RingkasanAsetPeriode,
  label: string
): Promise<RingkasanAsetSnapshot> {
  const akhir = new Date(sampai);
  akhir.setHours(23, 59, 59, 999);

  const [asetList, akunDb] = await Promise.all([
    prisma.aset.findMany({
      select: {
        id: true,
        namaAset: true,
        jumlah: true,
        kategori: true,
        statusAset: true,
        nilaiAset: true,
        tanggalPerolehan: true,
        tanggalAkuisisi: true,
        biayaAkuisisi: true,
        akunAset: true,
        metodeSusut: true,
        masaManfaatBulan: true,
        nilaiResidu: true,
        tanggalMulaiSusut: true,
        tanggalLepas: true,
      },
    }),
    prisma.akunCOA.findMany({ select: { kode: true, nama: true } }),
  ]);

  const akunMap = new Map(akunDb.map((a) => [a.kode, a.nama]));
  const kelompokMap = new Map<
    string,
    {
      kode: string;
      nama: string;
      baris: RingkasanAsetBaris[];
      subtotalBiayaAwal: number;
      subtotalAkumulasiPenyusutan: number;
      subtotalNilaiBuku: number;
    }
  >();

  for (const a of asetList) {
    if (!isAktifPadaTanggal(a, akhir)) continue;

    const biayaAwal = rupiah(
      a.biayaAkuisisi == null ? Number(a.nilaiAset) * a.jumlah : a.biayaAkuisisi
    );
    const nilaiResidu = rupiah(a.nilaiResidu);
    const susut = hitungSusut(
      biayaAwal,
      nilaiResidu,
      a.masaManfaatBulan ?? 0,
      a.metodeSusut,
      a.tanggalMulaiSusut ? new Date(a.tanggalMulaiSusut) : null,
      akhir
    );

    const kodeAkun = (a.akunAset ?? "").trim() || KODE_ASET_BY_KATEGORI[a.kategori] || "";
    const akunNama =
      (kodeAkun ? akunMap.get(kodeAkun) : undefined) ??
      (kodeAkun ? getAkunByKode(kodeAkun)?.nama : undefined) ??
      (kodeAkun ? `Akun ${kodeAkun}` : "Tanpa akun aset");
    const grupKode = kodeAkun || "(tanpa akun)";
    const tanggal = a.tanggalAkuisisi ?? a.tanggalPerolehan;

    const baris: RingkasanAsetBaris = {
      nomorAset: a.id,
      namaAset: a.namaAset,
      tanggalAkuisisi: tanggal ? tanggal.toISOString() : null,
      kategori: a.kategori,
      akunAset: kodeAkun,
      akunNama,
      biayaAwal,
      akumulasiPenyusutan: susut.akumulasi,
      nilaiBuku: biayaAwal - susut.akumulasi,
      metodeSusut: a.metodeSusut,
    };

    let grup = kelompokMap.get(grupKode);
    if (!grup) {
      grup = {
        kode: grupKode,
        nama: akunNama,
        baris: [],
        subtotalBiayaAwal: 0,
        subtotalAkumulasiPenyusutan: 0,
        subtotalNilaiBuku: 0,
      };
      kelompokMap.set(grupKode, grup);
    }
    grup.baris.push(baris);
    grup.subtotalBiayaAwal += baris.biayaAwal;
    grup.subtotalAkumulasiPenyusutan += baris.akumulasiPenyusutan;
    grup.subtotalNilaiBuku += baris.nilaiBuku;
  }

  const kelompok: RingkasanAsetKelompok[] = [...kelompokMap.values()].sort((a, b) => {
    if (a.kode === "(tanpa akun)") return 1;
    if (b.kode === "(tanpa akun)") return -1;
    return a.kode.localeCompare(b.kode, "id", { numeric: true });
  });

  for (const g of kelompok) {
    g.baris.sort((a, b) => {
      const ta = a.tanggalAkuisisi ? new Date(a.tanggalAkuisisi).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.tanggalAkuisisi ? new Date(b.tanggalAkuisisi).getTime() : Number.MAX_SAFE_INTEGER;
      return ta !== tb ? ta - tb : a.nomorAset.localeCompare(b.nomorAset, "id", { numeric: true });
    });
  }

  const totalAset = kelompok.reduce((n, g) => n + g.baris.length, 0);
  const totalBiayaAwal = kelompok.reduce((n, g) => n + g.subtotalBiayaAwal, 0);
  const totalAkumulasiPenyusutan = kelompok.reduce(
    (n, g) => n + g.subtotalAkumulasiPenyusutan,
    0
  );
  const totalNilaiBuku = kelompok.reduce((n, g) => n + g.subtotalNilaiBuku, 0);

  const catatan: string[] = [
    "Hanya aset yang aktif pada tanggal akhir laporan yang ditampilkan. Aset tertunda serta aset yang sudah dijual/dilepas pada atau sebelum tanggal laporan tidak dihitung.",
    "Laporan adalah posisi aset per tanggal akhir; tanggal awal dipakai untuk menetapkan rentang periode laporan.",
    "Akumulasi penyusutan dihitung informatif mengikuti metode, masa manfaat, nilai residu, dan tanggal mulai susut yang tercatat; belum dijurnal otomatis.",
    "Nilai Buku = Biaya Awal - Akumulasi Penyusutan.",
  ];
  if (totalAset === 0) {
    catatan.unshift("Tidak ada aset tetap yang memenuhi kriteria pada periode ini.");
  }

  return {
    periode,
    start: dari.toISOString(),
    end: akhir.toISOString(),
    label,
    kelompok,
    totalAset,
    totalBiayaAwal,
    totalAkumulasiPenyusutan,
    totalNilaiBuku,
    catatan,
  };
}
