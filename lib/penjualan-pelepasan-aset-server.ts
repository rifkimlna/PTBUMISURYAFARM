// Service Laporan Penjualan/Pelepasan Aset Tetap (KHUSUS modul laporan ini).
// JANGAN diimpor dari Client Component - hanya Server Component & API route.
//
// Sumber data: master Aset asli di database. Tidak ada data dummy.
//
// Laporan ini menampilkan aset yang telah dijual/dilepas (statusAset = DIJUAL
// atau DILEPAS) dengan tanggal lepas dalam rentang tanggal yang dipilih.
//
// Perhitungan:
// - Biaya Awal = biayaAkuisisi (fallback: nilaiAset × jumlah).
// - Akumulasi Penyusutan = hitungSusut() s/d tanggal lepas (sama dengan halaman Aset).
// - Nilai Buku = Biaya Awal - Akumulasi Penyusutan.
// - Harga Jual = hargaJual dari master aset (0 untuk Dilepas Tanpa Penjualan).
// - Untung/Rugi = Harga Jual - Nilai Buku.
// - Status = kombinasi caraLepas (DIJUAL/DILEPAS) dan statusPembayaran.
// - Akun Penerima/Piutang = akunPenerima untuk Sudah Dibayar, 1102 Piutang untuk
//   Belum Dibayar, "-" untuk Dilepas Tanpa Penjualan atau Belum Dikonfirmasi.
//
// Tidak membuat jurnal otomatis dan tidak mengubah data transaksi.

import { prisma } from "@/lib/prisma";
import { getAkunByKode } from "@/lib/coa";
import { hitungSusut } from "@/lib/aset";
import type {
  PenjualanPelepasanBaris,
  PenjualanPelepasanKelompok,
  PenjualanPelepasanSnapshot,
} from "@/lib/penjualan-pelepasan-aset-types";
import type { RingkasanAsetPeriode } from "@/lib/ringkasan-aset-types";

export {
  RINGKASAN_ASET_PERIODE,
  RINGKASAN_ASET_PERIODE_LABEL,
  resolveRingkasanAsetPeriode,
} from "@/lib/ringkasan-aset-types";
export type {
  PenjualanPelepasanBaris,
  PenjualanPelepasanKelompok,
  PenjualanPelepasanSnapshot,
  RingkasanAsetPeriode,
} from "@/lib/penjualan-pelepasan-aset-types";

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

function isWithin(d: Date | null, dari: Date, sampai: Date): boolean {
  if (!d) return false;
  const t = d.getTime();
  return t >= dari.getTime() && t <= sampai.getTime();
}

function statusLabel(
  jenisPelepasan: string | null,
  statusPembayaran: string | null
): string {
  const jenis = (jenisPelepasan ?? "").toUpperCase();
  const pembayaran = (statusPembayaran ?? "").toUpperCase();

  if (jenis === "DILEPAS") {
    return "Dilepas Tanpa Penjualan";
  }
  if (jenis === "DIJUAL") {
    if (pembayaran === "SUDAH_DIBAYAR") return "Dijual – Sudah Dibayar";
    if (pembayaran === "BELUM_DIBAYAR") return "Dijual – Belum Dibayar";
    return "Dijual – Belum Dikonfirmasi";
  }
  return "—";
}

function akunPenerikaInfo(
  jenisPelepasan: string | null,
  statusPembayaran: string | null,
  akunPenerima: string | null,
  akunMap: Map<string, string>
): { kode: string; nama: string } {
  const jenis = (jenisPelepasan ?? "").toUpperCase();
  const pembayaran = (statusPembayaran ?? "").toUpperCase();

  if (jenis === "DIJUAL" && pembayaran === "SUDAH_DIBAYAR" && akunPenerima) {
    const kode = akunPenerima.trim();
    const nama =
      akunMap.get(kode) ??
      getAkunByKode(kode)?.nama ??
      (kode ? `Akun ${kode}` : "-");
    return { kode, nama };
  }
  if (jenis === "DIJUAL" && pembayaran === "BELUM_DIBAYAR") {
    const nama = akunMap.get("1102") ?? getAkunByKode("1102")?.nama ?? "Akun 1102";
    return { kode: "1102", nama };
  }
  return { kode: "-", nama: "-" };
}

export async function getPenjualanPelepasanSnapshot(
  dari: Date,
  sampai: Date,
  periode: RingkasanAsetPeriode,
  label: string
): Promise<PenjualanPelepasanSnapshot> {
  const awal = new Date(dari);
  awal.setHours(0, 0, 0, 0);
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
        hargaJual: true,
        noTransaksiLepas: true,
        caraLepas: true,
        statusPembayaran: true,
        akunPenerima: true,
        untungRugi: true,
      },
      where: {
        statusAset: { in: ["DIJUAL", "DILEPAS"] },
      },
      orderBy: { tanggalLepas: "asc" },
    }),
    prisma.akunCOA.findMany({ select: { kode: true, nama: true } }),
  ]);

  const akunMap = new Map(akunDb.map((a) => [a.kode, a.nama]));
  const kelompokMap = new Map<
    string,
    {
      kode: string;
      nama: string;
      baris: PenjualanPelepasanBaris[];
      subtotalBiayaAwal: number;
      subtotalAkumulasiPenyusutan: number;
      subtotalNilaiBuku: number;
      subtotalHargaJual: number;
      subtotalUntungRugi: number;
    }
  >();

  for (const a of asetList) {
    const tanggalLepas = a.tanggalLepas ? new Date(a.tanggalLepas) : null;

    // Hanya tampilkan aset yang tanggal lepasnya dalam rentang laporan.
    if (!isWithin(tanggalLepas, awal, akhir)) continue;

    const tanggalAkuisisi = a.tanggalAkuisisi ? new Date(a.tanggalAkuisisi) : null;

    const biayaAwal = rupiah(
      a.biayaAkuisisi == null ? Number(a.nilaiAset) * a.jumlah : a.biayaAkuisisi
    );
    const nilaiResidu = rupiah(a.nilaiResidu);

    // Akumulasi penyusutan s/d tanggal pelepasan.
    const susut = hitungSusut(
      biayaAwal,
      nilaiResidu,
      a.masaManfaatBulan ?? 0,
      a.metodeSusut,
      a.tanggalMulaiSusut ? new Date(a.tanggalMulaiSusut) : null,
      tanggalLepas!
    );
    const akumulasiPenyusutan = susut.akumulasi;
    const nilaiBuku = Math.max(0, biayaAwal - akumulasiPenyusutan);

    const hargaJual = rupiah(a.hargaJual);
    const jenisPelepasan = (a.caraLepas ?? "").toUpperCase() as
      | "DIJUAL"
      | "DILEPAS";
    const statusPembayaran = a.statusPembayaran;

    // Untung/Rugi: gunakan nilai tersimpan jika ada, hitung jika belum.
    const untungRugi =
      a.untungRugi != null ? Number(a.untungRugi) : Math.round(hargaJual - nilaiBuku);

    const kodeAkun = (a.akunAset ?? "").trim() || KODE_ASET_BY_KATEGORI[a.kategori] || "";
    const akunNama =
      (kodeAkun ? akunMap.get(kodeAkun) : undefined) ??
      (kodeAkun ? getAkunByKode(kodeAkun)?.nama : undefined) ??
      (kodeAkun ? `Akun ${kodeAkun}` : "Tanpa akun aset");

    const { kode: akunPenerimaKode, nama: akunPenerimaNama } = akunPenerikaInfo(
      a.caraLepas,
      a.statusPembayaran,
      a.akunPenerima,
      akunMap
    );

    const baris: PenjualanPelepasanBaris = {
      nomorAset: a.id,
      namaAset: a.namaAset,
      kategori: a.kategori,
      akunAset: kodeAkun,
      akunNama,
      tanggalAkuisisi: tanggalAkuisisi ? tanggalAkuisisi.toISOString() : null,
      tanggalPelepasan: tanggalLepas ? tanggalLepas.toISOString() : null,
      biayaAwal,
      akumulasiPenyusutan,
      nilaiBuku,
      hargaJual,
      untungRugi,
      jenisPelepasan:
        jenisPelepasan === "DILEPAS" ? "DILEPAS" : "DIJUAL",
      statusPembayaran:
        (statusPembayaran as "SUDAH_DIBAYAR" | "BELUM_DIBAYAR" | "BELUM_DIKONFIRMASI") ||
        null,
      statusLabel: statusLabel(a.caraLepas, a.statusPembayaran),
      akunPenerima: akunPenerimaKode,
      akunPenerimaNama,
      nomorTransaksi: a.noTransaksiLepas || null,
    };

    let grup = kelompokMap.get(kodeAkun);
    if (!grup) {
      grup = {
        kode: kodeAkun,
        nama: akunNama,
        baris: [],
        subtotalBiayaAwal: 0,
        subtotalAkumulasiPenyusutan: 0,
        subtotalNilaiBuku: 0,
        subtotalHargaJual: 0,
        subtotalUntungRugi: 0,
      };
      kelompokMap.set(kodeAkun, grup);
    }
    grup.baris.push(baris);
    grup.subtotalBiayaAwal += baris.biayaAwal;
    grup.subtotalAkumulasiPenyusutan += baris.akumulasiPenyusutan;
    grup.subtotalNilaiBuku += baris.nilaiBuku;
    grup.subtotalHargaJual += baris.hargaJual;
    grup.subtotalUntungRugi += baris.untungRugi;
  }

  const kelompok: PenjualanPelepasanKelompok[] = [...kelompokMap.values()].sort(
    (a, b) => {
      if (a.kode === "(tanpa akun)") return 1;
      if (b.kode === "(tanpa akun)") return -1;
      return a.kode.localeCompare(b.kode, "id", { numeric: true });
    }
  );

  for (const g of kelompok) {
    g.baris.sort((a, b) => {
      const ta = a.tanggalPelepasan
        ? new Date(a.tanggalPelepasan).getTime()
        : Number.MAX_SAFE_INTEGER;
      const tb = b.tanggalPelepasan
        ? new Date(b.tanggalPelepasan).getTime()
        : Number.MAX_SAFE_INTEGER;
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
  const totalHargaJual = kelompok.reduce((n, g) => n + g.subtotalHargaJual, 0);
  const totalUntungRugi = kelompok.reduce((n, g) => n + g.subtotalUntungRugi, 0);

  const catatan: string[] = [
    "Hanya aset dengan status Dijual atau Dilepas yang memiliki tanggal lepas dalam rentang laporan yang ditampilkan.",
    "Biaya Awal = biaya akuisisi. Akumulasi Penyusutan dihitung s/d tanggal pelepasan.",
    "Nilai Buku = Biaya Awal - Akumulasi Penyusutan. Untung/Rugi = Harga Jual - Nilai Buku.",
    "Akun Penerima/Piutang = akun penerima Kas/Bank/Tabungan (Sudah Dibayar), 1102 Piutang (Belum Dibayar), atau '-' (Dilepas/Belum Dikonfirmasi).",
    "Untung/Rugi menggunakan nilai yang tersimpan di database; jika belum ada, dihitung sebagai Harga Jual − Nilai Buku.",
  ];
  if (totalAset === 0) {
    catatan.unshift("Tidak ada penjualan atau pelepasan aset tetap pada periode ini.");
  }

  return {
    periode: periode,
    start: awal.toISOString(),
    end: akhir.toISOString(),
    label,
    kelompok,
    totalAset,
    totalBiayaAwal,
    totalAkumulasiPenyusutan,
    totalNilaiBuku,
    totalHargaJual,
    totalUntungRugi,
    catatan,
  };
}
