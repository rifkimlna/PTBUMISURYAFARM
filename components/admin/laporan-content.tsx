"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// Halaman Laporan PT BST — UI SAJA (tahap ini).
// Daftar menu laporan statis (bukan data dummy): belum ada halaman detail,
// API, maupun database laporan. Semua tombol nonaktif.

type Aksi = "lihat" | "ekspor";

type Laporan = {
  judul: string;
  deskripsi: string;
  aksi: Aksi;
};

const TABS: { key: string; label: string }[] = [
  { key: "sekilas-bisnis", label: "Sekilas Bisnis" },
  { key: "penjualan", label: "Penjualan" },
  { key: "pembelian", label: "Pembelian" },
  { key: "produk", label: "Produk" },
  { key: "aset", label: "Aset" },
  { key: "bank", label: "Bank" },
  { key: "pajak", label: "Pajak" },
  { key: "produksi", label: "Produksi" },
];

const LAPORAN: Record<string, Laporan[]> = {
  "sekilas-bisnis": [
    { judul: "Neraca", deskripsi: "Posisi aset, kewajiban, dan modal pada titik waktu tertentu.", aksi: "lihat" },
    { judul: "Buku Besar", deskripsi: "Rincian mutasi setiap akun dalam periode berjalan.", aksi: "ekspor" },
    { judul: "Laba Rugi", deskripsi: "Pendapatan, beban, dan laba bersih pada periode berjalan.", aksi: "lihat" },
    { judul: "Jurnal", deskripsi: "Seluruh jurnal transaksi tercatat secara kronologis.", aksi: "ekspor" },
    { judul: "Arus Kas", deskripsi: "Aliran kas masuk dan keluar per aktivitas usaha.", aksi: "lihat" },
    { judul: "Neraca Saldo", deskripsi: "Saldo tiap akun untuk memastikan total debit sama dengan kredit.", aksi: "lihat" },
    { judul: "Perubahan Modal", deskripsi: "Pergerakan modal pemilik selama periode berjalan.", aksi: "lihat" },
    { judul: "Ringkasan Bisnis", deskripsi: "Gambaran kinerja bisnis dalam satu tampilan ringkas.", aksi: "lihat" },
    { judul: "Anggaran Laba Rugi", deskripsi: "Perbandingan realisasi dengan anggaran laba rugi.", aksi: "lihat" },
    { judul: "Manajemen Anggaran", deskripsi: "Kelola dan pantau anggaran pada setiap akun.", aksi: "lihat" },
  ],
  penjualan: [
    { judul: "Daftar Penjualan", deskripsi: "Seluruh transaksi penjualan dalam periode.", aksi: "ekspor" },
    { judul: "Penjualan per Pelanggan", deskripsi: "Total penjualan yang dikelompokkan per pelanggan.", aksi: "lihat" },
    { judul: "Piutang Pelanggan", deskripsi: "Saldo piutang pada setiap pelanggan.", aksi: "lihat" },
    { judul: "Usia Piutang", deskripsi: "Pengelompokan piutang berdasarkan umur tagihan.", aksi: "lihat" },
    { judul: "Pengiriman Penjualan", deskripsi: "Daftar pengiriman barang kepada pelanggan.", aksi: "ekspor" },
    { judul: "Penjualan per Produk", deskripsi: "Total penjualan yang dikelompokkan per produk.", aksi: "lihat" },
    { judul: "Penyelesaian Pesanan Penjualan", deskripsi: "Status pemenuhan setiap pesanan penjualan.", aksi: "lihat" },
    { judul: "Profitabilitas Produk", deskripsi: "Margin keuntungan pada setiap produk.", aksi: "lihat" },
    { judul: "Daftar Faktur Proforma", deskripsi: "Seluruh faktur proforma yang telah diterbitkan.", aksi: "ekspor" },
    { judul: "Daftar Tukar Faktur", deskripsi: "Seluruh dokumen tukar faktur yang telah dibuat.", aksi: "ekspor" },
  ],
  pembelian: [
    { judul: "Daftar Pembelian", deskripsi: "Seluruh transaksi pembelian dalam periode.", aksi: "ekspor" },
    { judul: "Pembelian per Supplier", deskripsi: "Total pembelian yang dikelompokkan per supplier.", aksi: "lihat" },
    { judul: "Utang Supplier", deskripsi: "Saldo utang pada setiap supplier.", aksi: "lihat" },
    { judul: "Daftar Pengeluaran", deskripsi: "Seluruh pengeluaran kas dalam periode.", aksi: "ekspor" },
    { judul: "Detail Pengeluaran", deskripsi: "Rincian setiap pengeluaran kas per transaksi.", aksi: "lihat" },
    { judul: "Usia Utang", deskripsi: "Pengelompokan utang berdasarkan umur tagihan.", aksi: "lihat" },
    { judul: "Pengiriman Pembelian", deskripsi: "Daftar penerimaan barang dari supplier.", aksi: "ekspor" },
    { judul: "Pembelian per Produk", deskripsi: "Total pembelian yang dikelompokkan per produk.", aksi: "lihat" },
    { judul: "Penyelesaian Pesanan Pembelian", deskripsi: "Status pemenuhan setiap pesanan pembelian.", aksi: "lihat" },
  ],
  produk: [
    { judul: "Tingkat Pemenuhan Pesanan", deskripsi: "Persentase pesanan yang terpenuhi dari persediaan.", aksi: "lihat" },
    { judul: "Perputaran Persediaan Barang", deskripsi: "Kecepatan perputaran barang dalam periode.", aksi: "lihat" },
    { judul: "Konversi Produk", deskripsi: "Riwayat konversi antar produk dan satuannya.", aksi: "lihat" },
    { judul: "Ringkasan Persediaan Barang", deskripsi: "Gambaran stok dan nilai persediaan secara ringkas.", aksi: "lihat" },
    { judul: "Kuantitas Stok Gudang", deskripsi: "Jumlah stok setiap produk per gudang.", aksi: "lihat" },
    { judul: "Nilai Persediaan Barang", deskripsi: "Nilai persediaan setiap produk.", aksi: "lihat" },
    { judul: "Nilai Stok Gudang", deskripsi: "Nilai stok yang tersimpan per gudang.", aksi: "lihat" },
    { judul: "Detail Persediaan Barang", deskripsi: "Rincian mutasi setiap barang persediaan.", aksi: "lihat" },
    { judul: "Pergerakan Barang Gudang", deskripsi: "Barang masuk dan keluar pada setiap gudang.", aksi: "lihat" },
    { judul: "Kuantitas Produk dengan Nomor Seri", deskripsi: "Stok produk bernomor seri per nomornya.", aksi: "lihat" },
    { judul: "Gudang Berisi Produk Bernomor Seri", deskripsi: "Sebaran produk bernomor seri pada setiap gudang.", aksi: "lihat" },
  ],
  aset: [
    { judul: "Ringkasan Aset Tetap", deskripsi: "Nilai dan kondisi aset tetap secara ringkas.", aksi: "lihat" },
    { judul: "Detail Aset Tetap", deskripsi: "Rincian setiap aset tetap beserta penyusutannya.", aksi: "lihat" },
    { judul: "Penjualan atau Pelepasan Aset", deskripsi: "Riwayat aset yang dijual atau dilepas.", aksi: "lihat" },
  ],
  bank: [
    { judul: "Ringkasan Rekonsiliasi Bank", deskripsi: "Status rekonsiliasi setiap rekening bank.", aksi: "lihat" },
    { judul: "Mutasi Rekening Koran", deskripsi: "Arus mutasi pada rekening koran bank.", aksi: "ekspor" },
  ],
  pajak: [
    { judul: "Pajak Pemotongan", deskripsi: "Rekap pajak yang dipotong dari transaksi.", aksi: "lihat" },
    { judul: "Pajak Penjualan", deskripsi: "Rekap pajak atas transaksi penjualan.", aksi: "lihat" },
  ],
  produksi: [
    { judul: "Penyusunan Produksi", deskripsi: "Riwayat perakitan bahan menjadi produk jadi.", aksi: "lihat" },
    { judul: "Pemisahan Produksi", deskripsi: "Riwayat pemecahan produk menjadi komponen.", aksi: "lihat" },
    { judul: "Harga Pokok Produksi (COGM)", deskripsi: "Biaya produksi atas barang yang dihasilkan.", aksi: "lihat" },
  ],
};

export function LaporanContent() {
  const [tab, setTab] = useState("sekilas-bisnis");
  const [cari, setCari] = useState("");

  const daftar = useMemo(() => {
    const semua = LAPORAN[tab] ?? [];
    const q = cari.trim().toLowerCase();
    if (!q) return semua;
    return semua.filter((l) => `${l.judul} ${l.deskripsi}`.toLowerCase().includes(q));
  }, [tab, cari]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 text-xs font-medium">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 transition-colors ${
                tab === t.key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari laporan..."
            className="pl-9"
            aria-label="Cari laporan"
          />
        </div>
      </div>

      {daftar.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Tidak ada laporan yang cocok dengan pencarian.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {daftar.map((l) => (
            <Card key={l.judul} className="border-slate-200">
              <CardContent className="flex min-h-36 flex-col p-5">
                <h3 className="text-sm font-semibold text-slate-900">{l.judul}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{l.deskripsi}</p>
                <div className="mt-auto pt-4">
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    title="Segera hadir"
                    className={
                      l.aksi === "ekspor"
                        ? "cursor-not-allowed bg-slate-900 text-white hover:bg-slate-900 disabled:opacity-60"
                        : "cursor-not-allowed bg-emerald-700 text-white hover:bg-emerald-700 disabled:opacity-60"
                    }
                  >
                    {l.aksi === "ekspor" ? "Ekspor laporan" : "Lihat laporan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400">
        Halaman laporan tahap awal — tombol belum difungsikan dan belum ada halaman detail laporan.
      </p>
    </div>
  );
}
