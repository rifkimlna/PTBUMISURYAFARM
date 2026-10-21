// Service Laporan Detail Aset Tetap (KHUSUS modul laporan ini).
// JANGAN diimpor dari Client Component - hanya Server Component & API route.
//
// Sumber data: master Aset asli di database + TransaksiKas / Tagihan terkait.
// Tidak ada data dummy.
//
// Logika data transaksi:
// - Akuisisi tunai: TransaksiKas (id disimpan di aset.transaksiKasId),
//   Debit akunAset / Kredit akunKredit (Kas/Bank/Tabungan).
// - Akuisisi kredit: Tagihan (id disimpan di aset.tagihanId), belum ada
//   TransaksiKas sampai pelunasan. Ditampilkan sebagai Debit akunAset /
//   Kredit akunKredit.
// - Penyusutan: hanya hitungSusut() informatif, BELUM dijurnal -> baris
//   informatif dengan "-" pada Debit/Kredit, tidak dihitung dalam saldo jurnal.
// - Pelepasan Dijual–Sudah Dibayar: TransaksiKas PEMASUKAN (id disimpan di
//   aset.transaksiKasJualId). Debit akunPenerima (Kas/Bank/Tabungan),
//   Kredit akunAset = harga jual.
// - Pelepasan Dijual–Belum Dibayar: Tagihan tipe PIUTANG (id disimpan di
//   aset.tagihanPiutangId). Debit 1102 Piutang, Kredit akunAset = harga jual.
//   Belum menerima kas.
// - Pelepasan Dilepas Tanpa Penjualan: tidak ada penerimaan uang -> baris
//   informatif dengan "-" pada Debit/Kredit.
// - Nilai buku = berjalan berdasarkan akuisisi dan pelepasan yang valid.

import { prisma } from "@/lib/prisma";
import { getAkunByKode } from "@/lib/coa";
import { hitungSusut } from "@/lib/aset";
import type {
  DetailAsetBaris,
  DetailAsetGrup,
  DetailAsetSnapshot,
  RingkasanAsetPeriode,
} from "@/lib/ringkasan-aset-detail-types";

export {
  RINGKASAN_ASET_PERIODE,
  RINGKASAN_ASET_PERIODE_LABEL,
  resolveRingkasanAsetPeriode,
} from "@/lib/ringkasan-aset-types";
export type {
  DetailAsetBaris,
  DetailAsetGrup,
  DetailAsetSnapshot,
  RingkasanAsetPeriode,
} from "@/lib/ringkasan-aset-detail-types";

function rupiah(v: unknown): number {
  return Math.round(Number(v ?? 0));
}

function isWithin(d: Date | null, dari: Date, sampai: Date): boolean {
  if (!d) return false;
  const t = d.getTime();
  return t >= dari.getTime() && t <= sampai.getTime();
}

export async function getDetailAsetSnapshot(
  dari: Date,
  sampai: Date,
  periode: RingkasanAsetPeriode,
  label: string
): Promise<DetailAsetSnapshot> {
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
        akunKredit: true,
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
        transaksiKasJualId: true,
        tagihanPiutangId: true,
        transaksiKasId: true,
        tagihanId: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.akunCOA.findMany({ select: { kode: true, nama: true } }),
  ]);

  const akunMap = new Map(akunDb.map((a) => [a.kode, a.nama]));

  // Kumpulkan ID transaksi terkait pelepasan untuk di-fetch sekaligus.
  const jualKasIds = asetList
    .map((a) => a.transaksiKasJualId)
    .filter((id): id is string => Boolean(id));
  const jualTagihanIds = asetList
    .map((a) => a.tagihanPiutangId)
    .filter((id): id is string => Boolean(id));
  const akuisisiKasIds = asetList
    .map((a) => a.transaksiKasId)
    .filter((id): id is string => Boolean(id));
  const akuisisiTagihanIds = asetList
    .map((a) => a.tagihanId)
    .filter((id): id is string => Boolean(id));

  const allTrxIds = [...new Set([...akuisisiKasIds, ...jualKasIds])];
  const allTagihanIds = [...new Set([...akuisisiTagihanIds, ...jualTagihanIds])];

  const [trxKasList, tagihanList] = await Promise.all([
    allTrxIds.length > 0
      ? prisma.transaksiKas.findMany({
          where: { id: { in: allTrxIds } },
          select: {
            id: true,
            tanggal: true,
            jumlah: true,
            kodeAkun: true,
            sumberDana: true,
            keterangan: true,
            noTransaksi: true,
            tipe: true,
          },
        })
      : Promise.resolve([]),
    allTagihanIds.length > 0
      ? prisma.tagihan.findMany({
          where: { id: { in: allTagihanIds } },
          select: {
            id: true,
            tanggal: true,
            jumlah: true,
            keterangan: true,
            pihak: true,
            status: true,
            tipe: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const trxById = new Map(trxKasList.map((t) => [t.id, t]));
  const tagihanById = new Map(tagihanList.map((t) => [t.id, t]));

  const grupMap = new Map<string, DetailAsetGrup>();

  for (const a of asetList) {
    const tanggalAkuisisi = a.tanggalAkuisisi ? new Date(a.tanggalAkuisisi) : null;
    const tanggalLepas = a.tanggalLepas ? new Date(a.tanggalLepas) : null;

    const biayaAkuisisi = rupiah(
      a.biayaAkuisisi == null ? Number(a.nilaiAset) * a.jumlah : a.biayaAkuisisi
    );

    const akuisisiDalamPeriode = isWithin(tanggalAkuisisi, awal, akhir);
    const pelepasanDalamPeriode = isWithin(tanggalLepas, awal, akhir);
    const aktifAkhirPeriode =
      a.statusAset === "AKTIF" && tanggalAkuisisi && tanggalAkuisisi <= akhir;

    if (!akuisisiDalamPeriode && !pelepasanDalamPeriode && !aktifAkhirPeriode) {
      continue;
    }

    const kodeAkunDebet = (a.akunAset ?? "").trim();
    const kodeAkunKredit = (a.akunKredit ?? "").trim();
    const namaAkunDebet =
      (kodeAkunDebet ? akunMap.get(kodeAkunDebet) : undefined) ??
      (kodeAkunDebet ? getAkunByKode(kodeAkunDebet)?.nama : undefined) ??
      (kodeAkunDebet ? `Akun ${kodeAkunDebet}` : "-");
    const namaAkunKredit =
      (kodeAkunKredit ? akunMap.get(kodeAkunKredit) : undefined) ??
      (kodeAkunKredit ? getAkunByKode(kodeAkunKredit)?.nama : undefined) ??
      (kodeAkunKredit ? `Akun ${kodeAkunKredit}` : "-");
    const namaAkunPiutang =
      akunMap.get("1102") ?? getAkunByKode("1102")?.nama ?? "Akun 1102";

    const baris: DetailAsetBaris[] = [];
    let saldo = 0;

    // Saldo awal: bila akuisisi terjadi sebelum periode, nilai buku sudah ada.
    if (tanggalAkuisisi && tanggalAkuisisi < awal) {
      saldo = biayaAkuisisi;
    }

    // --- Akuisisi dalam periode ---
    if (akuisisiDalamPeriode && tanggalAkuisisi) {
      saldo = biayaAkuisisi;

      const trxKas = a.transaksiKasId ? trxById.get(a.transaksiKasId) : undefined;
      const tagihan = a.tagihanId ? tagihanById.get(a.tagihanId) : undefined;
      const nomorDokumen = trxKas?.noTransaksi ?? tagihan?.id ?? a.id;
      const tanggalTrx = trxKas?.tanggal ?? tagihan?.tanggal ?? tanggalAkuisisi;

      // Debit: akunAset
      baris.push({
        tanggal: tanggalTrx.toISOString(),
        tindakan: "AKUISISI",
        transaksi: "Akuisisi Aset Tetap",
        nomor: nomorDokumen,
        nomorAkun: kodeAkunDebet || "-",
        namaAkun: namaAkunDebet,
        debit: biayaAkuisisi,
        kredit: 0,
        nilaiBuku: saldo,
        isInformational: false,
      });

      // Kredit: akunKredit
      baris.push({
        tanggal: tanggalTrx.toISOString(),
        tindakan: "AKUISISI",
        transaksi: "Akuisisi Aset Tetap",
        nomor: nomorDokumen,
        nomorAkun: kodeAkunKredit || "-",
        namaAkun: namaAkunKredit,
        debit: 0,
        kredit: biayaAkuisisi,
        nilaiBuku: saldo,
        isInformational: false,
      });
    }

    // --- Penyusutan informatif (bukan jurnal aktual) ---
    if (
      a.statusAset === "AKTIF" &&
      a.metodeSusut &&
      a.metodeSusut !== "NON_DEP" &&
      a.masaManfaatBulan &&
      a.masaManfaatBulan > 0 &&
      a.tanggalMulaiSusut
    ) {
      const susut = hitungSusut(
        biayaAkuisisi,
        rupiah(a.nilaiResidu),
        a.masaManfaatBulan,
        a.metodeSusut,
        new Date(a.tanggalMulaiSusut),
        akhir
      );
      if (susut.akumulasi > 0) {
        baris.push({
          tanggal: null,
          tindakan: "PENYUSUTAN",
          transaksi: "Penyusutan Aset Tetap (informatif)",
          nomor: "-",
          nomorAkun: "-",
          namaAkun: "-",
          debit: 0,
          kredit: 0,
          nilaiBuku: saldo,
          isInformational: true,
        });
      }
    }

    // --- Pelepasan dalam periode ---
    if (pelepasanDalamPeriode && tanggalLepas) {
      const hargaJual = rupiah(a.hargaJual);
      const statusPembayaran = a.statusPembayaran ?? "BELUM_DIKONFIRMASI";

      // Hitung akumulasi penyusutan dan nilai buku s/d tanggal pelepasan.
      const susutLepas = hitungSusut(
        biayaAkuisisi,
        rupiah(a.nilaiResidu),
        a.masaManfaatBulan ?? 0,
        a.metodeSusut,
        a.tanggalMulaiSusut ? new Date(a.tanggalMulaiSusut) : null,
        tanggalLepas
      );
      const nilaiBukuLepas = Math.max(0, biayaAkuisisi - susutLepas.akumulasi);
      const labaRugiPelepasan = Math.round(hargaJual - nilaiBukuLepas);

      if (statusPembayaran === "SUDAH_DIBAYAR" && a.transaksiKasJualId) {
        // Jual – Sudah Dibayar: tunai diterima ke akunPenerima (Kas/Bank/Tabungan).
        const trxJual = trxById.get(a.transaksiKasJualId);
        const tanggalTrx = trxJual ? trxJual.tanggal : tanggalLepas;
        const nomorTrx = trxJual?.noTransaksi ?? a.noTransaksiLepas ?? "-";
        const akunPenerimaKode = a.akunPenerima ?? "";
        const namaAkunPenerima =
          (akunPenerimaKode ? akunMap.get(akunPenerimaKode) : undefined) ??
          (akunPenerimaKode ? getAkunByKode(akunPenerimaKode)?.nama : undefined) ??
          (akunPenerimaKode ? `Akun ${akunPenerimaKode}` : "-");

        // Debit: akunPenerima (Kas/Bank/Tabungan) = harga jual
        baris.push({
          tanggal: tanggalTrx.toISOString(),
          tindakan: "PELEPASAN",
          transaksi: `Jual Aset Tetap (Rp ${hargaJual.toLocaleString("id-ID")})`,
          nomor: nomorTrx,
          nomorAkun: akunPenerimaKode || "-",
          namaAkun: namaAkunPenerima,
          debit: hargaJual,
          kredit: 0,
          nilaiBuku: 0,
          isInformational: false,
        });

        // Kredit: akunAset = NILAI BUKU (bukan harga jual)
        baris.push({
          tanggal: tanggalTrx.toISOString(),
          tindakan: "PELEPASAN",
          transaksi: `Jual Aset Tetap (Rp ${hargaJual.toLocaleString("id-ID")})`,
          nomor: nomorTrx,
          nomorAkun: kodeAkunDebet || "-",
          namaAkun: namaAkunDebet,
          debit: 0,
          kredit: nilaiBukuLepas,
          nilaiBuku: 0,
          isInformational: false,
        });

        // Laba/Rugi pelepasan = selisih harga jual dan nilai buku.
        if (labaRugiPelepasan > 0) {
          baris.push({
            tanggal: tanggalTrx.toISOString(),
            tindakan: "PELEPASAN",
            transaksi: `Laba Pelepasan Aset Tetap`,
            nomor: nomorTrx,
            nomorAkun: "-",
            namaAkun: "Laba Pelepasan Aset Tetap",
            debit: 0,
            kredit: labaRugiPelepasan,
            nilaiBuku: 0,
            isInformational: false,
          });
        } else if (labaRugiPelepasan < 0) {
          baris.push({
            tanggal: tanggalTrx.toISOString(),
            tindakan: "PELEPASAN",
            transaksi: `Rugi Pelepasan Aset Tetap`,
            nomor: nomorTrx,
            nomorAkun: "-",
            namaAkun: "Rugi Pelepasan Aset Tetap",
            debit: Math.abs(labaRugiPelepasan),
            kredit: 0,
            nilaiBuku: 0,
            isInformational: false,
          });
        }

        saldo = 0;

      } else if (statusPembayaran === "BELUM_DIBAYAR" && a.tagihanPiutangId) {
        // Jual – Belum Dibayar: piutang, belum menerima kas.
        const tagihanJual = tagihanById.get(a.tagihanPiutangId);
        const tanggalTrx = tagihanJual ? tagihanJual.tanggal : tanggalLepas;
        const nomorTrx = tagihanJual?.id ?? a.noTransaksiLepas ?? "-";

        // Debit: 1102 Piutang = harga jual
        baris.push({
          tanggal: tanggalTrx.toISOString(),
          tindakan: "PELEPASAN",
          transaksi: `Jual Aset Tetap – Piutang (Rp ${hargaJual.toLocaleString("id-ID")})`,
          nomor: nomorTrx,
          nomorAkun: "1102",
          namaAkun: namaAkunPiutang,
          debit: hargaJual,
          kredit: 0,
          nilaiBuku: 0,
          isInformational: false,
        });

        // Kredit: akunAset = NILAI BUKU (bukan harga jual)
        baris.push({
          tanggal: tanggalTrx.toISOString(),
          tindakan: "PELEPASAN",
          transaksi: `Jual Aset Tetap – Piutang (Rp ${hargaJual.toLocaleString("id-ID")})`,
          nomor: nomorTrx,
          nomorAkun: kodeAkunDebet || "-",
          namaAkun: namaAkunDebet,
          debit: 0,
          kredit: nilaiBukuLepas,
          nilaiBuku: 0,
          isInformational: false,
        });

        // Laba/Rugi pelepasan.
        if (labaRugiPelepasan > 0) {
          baris.push({
            tanggal: tanggalTrx.toISOString(),
            tindakan: "PELEPASAN",
            transaksi: `Laba Pelepasan Aset Tetap`,
            nomor: nomorTrx,
            nomorAkun: "-",
            namaAkun: "Laba Pelepasan Aset Tetap",
            debit: 0,
            kredit: labaRugiPelepasan,
            nilaiBuku: 0,
            isInformational: false,
          });
        } else if (labaRugiPelepasan < 0) {
          baris.push({
            tanggal: tanggalTrx.toISOString(),
            tindakan: "PELEPASAN",
            transaksi: `Rugi Pelepasan Aset Tetap`,
            nomor: nomorTrx,
            nomorAkun: "-",
            namaAkun: "Rugi Pelepasan Aset Tetap",
            debit: Math.abs(labaRugiPelepasan),
            kredit: 0,
            nilaiBuku: 0,
            isInformational: false,
          });
        }

        saldo = 0;

      } else {
        // Dilepas Tanpa Penjualan atau status belum dikonfirmasi: tidak ada
        // jurnal aktual di database. Tampilkan sebagai informasi Belum Dijurnal
        // dengan debit/kredit = 0 agar tidak mencampuri total jurnal aktual.
        const statusPembayaranLabel =
          statusPembayaran === "SUDAH_DIBAYAR"
            ? " (Sudah Dibayar)"
            : statusPembayaran === "BELUM_DIBAYAR"
              ? " (Belum Dibayar)"
              : statusPembayaran === "BELUM_DIKONFIRMASI"
                ? " (Belum Dikonfirmasi)"
                : "";
        const akunPenerimaLabel = a.akunPenerima ? ` via ${a.akunPenerima}` : "";

        const rugiLabel =
          nilaiBukuLepas > 0
            ? ` · Rugi pelepasan Rp ${nilaiBukuLepas.toLocaleString("id-ID")} (belum dijurnal)`
            : "";

        baris.push({
          tanggal: tanggalLepas.toISOString(),
          tindakan: "PELEPASAN",
          transaksi:
            a.caraLepas === "DIJUAL"
              ? `Jual Aset Tetap${statusPembayaranLabel}${akunPenerimaLabel} (Rp ${hargaJual.toLocaleString("id-ID")})${rugiLabel}`
              : `Lepas Aset Tetap${statusPembayaranLabel}${rugiLabel}`,
          nomor: a.noTransaksiLepas || "-",
          nomorAkun: "-",
          namaAkun: "-",
          debit: 0,
          kredit: 0,
          nilaiBuku: 0,
          isInformational: true,
        });

        saldo = 0;
      }
    }

    // Aktif akhir periode tanpa transaksi dalam periode: baris saldo tunggal.
    if (
      baris.length === 0 &&
      aktifAkhirPeriode &&
      tanggalAkuisisi &&
      tanggalAkuisisi < awal
    ) {
      baris.push({
        tanggal: null,
        tindakan: "AKUISISI",
        transaksi: "Saldo awal (akuisisi sebelum periode)",
        nomor: a.id,
        nomorAkun: kodeAkunDebet || "-",
        namaAkun: namaAkunDebet,
        debit: biayaAkuisisi,
        kredit: 0,
        nilaiBuku: biayaAkuisisi,
        isInformational: false,
      });
      saldo = biayaAkuisisi;
    }

    if (baris.length === 0) continue;

    const grup: DetailAsetGrup = {
      kode: a.id,
      nama: a.namaAset,
      kategori: a.kategori,
      akunAset: a.akunAset || null,
      tanggalAkuisisi: a.tanggalAkuisisi ? a.tanggalAkuisisi.toISOString() : null,
      biayaAkuisisi,
      statusAset: a.statusAset,
      tanggalLepas: a.tanggalLepas ? a.tanggalLepas.toISOString() : null,
      caraLepas: a.caraLepas || null,
      hargaJual: a.hargaJual ? Number(a.hargaJual) : null,
      statusPembayaran: a.statusPembayaran || null,
      akunPenerima: a.akunPenerima || null,
      untungRugi: a.untungRugi != null ? Number(a.untungRugi) : null,
      baris: baris.sort((x, y) => {
        if (!x.tanggal && !y.tanggal) return 0;
        if (!x.tanggal) return 1;
        if (!y.tanggal) return -1;
        return new Date(x.tanggal).getTime() - new Date(y.tanggal).getTime();
      }),
      subtotalDebit: baris.reduce((n, b) => n + b.debit, 0),
      subtotalKredit: baris.reduce((n, b) => n + b.kredit, 0),
      saldoAkhir: saldo,
    };

    grupMap.set(a.id, grup);
  }

  const grup: DetailAsetGrup[] = [...grupMap.values()];

  const totalAset = grup.length;
  const totalDebit = grup.reduce((n, g) => n + g.subtotalDebit, 0);
  const totalKredit = grup.reduce((n, g) => n + g.subtotalKredit, 0);
  const totalSaldoAkhir = grup.reduce((n, g) => n + g.saldoAkhir, 0);

  const catatan: string[] = [
    "Hanya transaksi jurnal aktual dari database (TransaksiKas / Tagihan terkait aset) yang ditampilkan sebagai Debit/Kredit.",
    "Jual–Sudah Dibayar: Debit akun penerima (Kas/Bank/Tabungan) = harga jual, Kredit akun aset tetap = nilai buku, selisih = Laba/Rugi pelepasan.",
    "Jual–Belum Dibayar: Debit Piutang (1102) = harga jual, Kredit akun aset tetap = nilai buku, selisih = Laba/Rugi pelepasan.",
    "Dilepas Tanpa Penjualan: tidak ada jurnal aktual (belum dijurnal). Ditampilkan sebagai informasi saja, tidak mempengaruhi total Debit/Kredit.",
    "Penyusutan dihitung informatif via hitungSusut() dan belum dijurnal otomatis — ditampilkan sebagai catatan, tidak mempengaruhi saldo jurnal.",
    "Nilai Buku = Biaya Akuisisi − Akumulasi Penyusutan s/t tanggal pelepasan atau akhir periode.",
  ];
  if (totalAset === 0) {
    catatan.unshift("Tidak ada transaksi aset tetap pada periode ini.");
  }

  return {
    periode: periode,
    start: awal.toISOString(),
    end: akhir.toISOString(),
    label,
    grup,
    totalAset,
    totalDebit,
    totalKredit,
    totalSaldoAkhir,
    catatan,
  };
}
