// Service Laporan Ringkasan Bisnis PT Bumi Surya Farm (KHUSUS modul ini).
// JANGAN diimpor dari Client Component — hanya Server Component & API route.
//
// Executive financial summary yang disusun dari snapshot resmi yang sudah ada
// (angka identik dengan masing-masing laporan sumber):
// - Laba Rugi (periode berjalan): getLabaRugiSnapshot — Pendapatan, HPP,
//   Laba Kotor, Biaya Operasional, Laba Operasional, Laba Bersih.
// - Neraca (posisi per akhir periode): getNeracaSnapshot — Aset Lancar,
//   Aset Tetap, Total Aset, Liabilitas, Modal, Total Liabilitas + Modal.
// - Arus Kas (periode berjalan): getArusKasSnapshot — Operasional,
//   Investasi, Pendanaan, Kenaikan/Penurunan Kas, Saldo Kas Akhir.
// - Wawasan Bisnis: rasio yang dihitung dari angka di atas (margin, likuiditas,
//   solvabilitas, profitabilitas). null bila penyebut Rp 0.
// Rentang periode + mode per-bulan memakai logic Arus Kas (template utama).

import {
  getArusKasSnapshot,
  monthRangesOfCurrentYear,
  resolveArusKasRange,
} from "@/lib/arus-kas-server";
import { getLabaRugiSnapshot } from "@/lib/laba-rugi-server";
import { getNeracaSnapshot } from "@/lib/neraca-server";
import type {
  RasioBaris,
  RingkasanBisnisPeriode,
  RingkasanBisnisSnapshot,
} from "@/lib/ringkasan-bisnis-types";

export {
  RINGKASAN_BISNIS_PERIODE,
  RINGKASAN_BISNIS_PERIODE_LABEL,
} from "@/lib/ringkasan-bisnis-types";
export type {
  RasioBaris,
  RingkasanBaris,
  RingkasanBisnisPeriode,
  RingkasanBisnisSnapshot,
} from "@/lib/ringkasan-bisnis-types";

/** Rentang periode — delegasi ke logic Arus Kas agar opsi & label identik. */
export function resolveRingkasanRange(
  periode: RingkasanBisnisPeriode,
  dari?: string,
  sampai?: string
): { start: Date; end: Date; label: string } {
  return resolveArusKasRange(periode, dari, sampai);
}

const num = (v: unknown) => Math.round(Number(v ?? 0));

function rasio(nama: string, pembilang: number, penyebut: number, satuan: "%" | "x"): RasioBaris {
  if (!Number.isFinite(penyebut) || penyebut === 0) return { nama, nilai: null, satuan };
  return { nama, nilai: pembilang / penyebut, satuan };
}

export async function getRingkasanBisnisSnapshot(
  start: Date,
  end: Date,
  periode: RingkasanBisnisPeriode,
  label: string
): Promise<RingkasanBisnisSnapshot> {
  const [lr, nr, ak] = await Promise.all([
    getLabaRugiSnapshot(start, end, periode as unknown as Parameters<typeof getLabaRugiSnapshot>[2], label),
    getNeracaSnapshot(end, periode as unknown as Parameters<typeof getNeracaSnapshot>[1], label, start),
    getArusKasSnapshot(start, end, periode, label),
  ]);

  const labaRugi = {
    pendapatan: num(lr.totalPendapatan),
    hpp: num(lr.totalHpp),
    labaKotor: num(lr.labaKotor),
    biayaOperasional: num(lr.totalBiayaOperasional),
    labaOperasional: num(lr.operasionalBersih),
    pendapatanLainnya: num(lr.totalPendapatanLainnya),
    biayaLainnya: num(lr.totalBiayaLainnya),
    labaBersih: num(lr.labaBersih),
  };

  const neraca = {
    asetLancar: num(nr.aktivaLancar.total),
    asetTetap: num(nr.aktivaTetap.total),
    penyusutan: num(nr.penyusutan.total),
    totalAset: num(nr.totalAktiva),
    liabilitasPendek: num(nr.totalKewajiban),
    liabilitasPanjang: 0,
    modal: num(nr.totalModal),
    totalLiabilitasModal: num(nr.totalKewajibanModal),
  };

  const arusKas = {
    operasional: num(ak.operasional.bersih),
    investasi: num(ak.investasi.bersih),
    pendanaan: num(ak.keuangan.bersih),
    kenaikan: num(ak.kenaikan),
    saldoAwal: num(ak.saldoAwal),
    saldoAkhir: num(ak.saldoAkhir),
  };

  const penyebutMargin = labaRugi.pendapatan + labaRugi.pendapatanLainnya;
  const wawasan: RasioBaris[] = [
    rasio("Margin Laba Kotor", labaRugi.labaKotor, labaRugi.pendapatan, "%"),
    rasio("Margin Laba Operasional", labaRugi.labaOperasional, labaRugi.pendapatan, "%"),
    rasio("Margin Keuntungan Bersih", labaRugi.labaBersih, penyebutMargin, "%"),
    rasio("Current Ratio", neraca.asetLancar, neraca.liabilitasPendek, "x"),
    rasio("Debt to Equity Ratio", neraca.liabilitasPendek, neraca.modal, "x"),
    rasio("Return on Asset", labaRugi.labaBersih, neraca.totalAset, "%"),
    rasio("Return on Equity", labaRugi.labaBersih, neraca.modal, "%"),
  ];

  const adaTransaksi =
    labaRugi.pendapatan !== 0 ||
    labaRugi.hpp !== 0 ||
    labaRugi.biayaOperasional !== 0 ||
    labaRugi.pendapatanLainnya !== 0 ||
    labaRugi.biayaLainnya !== 0 ||
    arusKas.kenaikan !== 0 ||
    neraca.totalAset !== 0 ||
    neraca.liabilitasPendek !== 0 ||
    neraca.modal !== 0;

  const catatan: string[] = [];
  if (!adaTransaksi) {
    catatan.push("Belum ada transaksi pada periode ini.");
    catatan.push("Data akan muncul setelah transaksi keuangan tersedia.");
  }
  for (const w of wawasan) {
    if (w.nilai === null) catatan.push(`${w.nama} tidak dihitung karena penyebutnya Rp 0 pada periode ini.`);
  }
  catatan.push("Liabilitas Jangka Panjang disajikan Rp 0 karena sistem belum mencatatnya terpisah.");

  return {
    periode,
    start: start.toISOString(),
    end: end.toISOString(),
    label,
    labaRugi,
    neraca,
    arusKas,
    wawasan,
    adaTransaksi,
    catatan: [...new Set(catatan)],
  };
}

/** Snapshot per bulan (Januari s/d bulan berjalan) untuk "per-bulan-tahun-ini". */
export async function getRingkasanBisnisBulanan(): Promise<RingkasanBisnisSnapshot[]> {
  const out: RingkasanBisnisSnapshot[] = [];
  for (const m of monthRangesOfCurrentYear()) {
    out.push(await getRingkasanBisnisSnapshot(m.start, m.end, "per-bulan-tahun-ini", m.label));
  }
  return out;
}
