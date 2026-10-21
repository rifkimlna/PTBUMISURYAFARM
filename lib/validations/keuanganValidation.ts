import { z } from "zod";
import { KATEGORI_ASET, STATUS_ASET } from "@/lib/aset";

export const TipeTransaksiEnum = z.enum(["PEMASUKAN", "PENGELUARAN", "TRANSFER"]);
export const SumberDanaEnum = z.enum(["KAS", "BANK", "TABUNGAN"]);
export const StatusGajiEnum = z.enum(["SUDAH_DIBAYAR", "PENDING"]);

export type TipeTransaksi = z.infer<typeof TipeTransaksiEnum>;
export type TipeTransaksiValue = "PEMASUKAN" | "PENGELUARAN" | "TRANSFER";
export type SumberDana = z.infer<typeof SumberDanaEnum>;

export const createBuktiTransaksiSchema = z.object({
  fileName: z.string().min(1, "Nama file wajib").max(200),
  fileUrl: z.string().min(1, "Path file wajib").max(500),
  fileType: z.string().max(100).optional(),
  fileSize: z.number().int().nonnegative().optional(),
});

export const createTransaksiKasSchema = z.object({
  tipe: TipeTransaksiEnum,
  kategori: z.string().min(2, "Kategori minimal 2 karakter").max(100),
  sumberDana: SumberDanaEnum.default("KAS"),
  // Akun tujuan (wajib utk TRANSFER antar Kas/Bank/Tabungan)
  sumberDanaTujuan: SumberDanaEnum.optional().nullable(),
  jumlah: z
    .number({ message: "Jumlah harus angka" })
    .positive("Jumlah harus positif")
    .min(1000, "Jumlah minimal Rp 1.000")
    .max(10_000_000_000, "Jumlah terlalu besar"),
  keterangan: z.string().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
  tanggal: z.coerce.date().optional(), // default now()
  // Field gaya Mekari (opsional; noTransaksi auto-generate bila kosong)
  noTransaksi: z.string().trim().max(50, "No transaksi maksimal 50 karakter").optional().nullable(),
  pihak: z.string().trim().max(150, "Nama pihak maksimal 150 karakter").optional().nullable(),
  tag: z.string().trim().max(100, "Tag maksimal 100 karakter").optional().nullable(),
  deskripsi: z.string().max(1000, "Deskripsi maksimal 1000 karakter").optional().nullable(),
  bukti: z.array(createBuktiTransaksiSchema).max(20, "Maksimal 20 bukti per transaksi").optional(),
  // adminId diambil dari session
}).refine(
  (data) => data.tipe !== "TRANSFER" || (data.sumberDanaTujuan != null && data.sumberDanaTujuan !== data.sumberDana),
  {
    message: "Akun tujuan transfer wajib diisi dan tidak boleh sama dengan akun asal",
    path: ["sumberDanaTujuan"],
  }
);

export const updateTransaksiKasSchema = z.object({
  tipe: TipeTransaksiEnum.optional(),
  kategori: z.string().min(2).max(100).optional(),
  sumberDana: SumberDanaEnum.optional(),
  sumberDanaTujuan: SumberDanaEnum.optional().nullable(),
  jumlah: z.number().positive().min(1000).max(10_000_000_000).optional(),
  keterangan: z.string().max(1000).optional().nullable(),
  tanggal: z.coerce.date().optional(),
  noTransaksi: z.string().trim().max(50).optional().nullable(),
  pihak: z.string().trim().max(150).optional().nullable(),
  tag: z.string().trim().max(100).optional().nullable(),
  deskripsi: z.string().max(1000).optional().nullable(),
  bukti: z.array(createBuktiTransaksiSchema).max(20, "Maksimal 20 bukti per transaksi").optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi",
});

export const queryKeuanganSchema = z.object({
  tipe: TipeTransaksiEnum.optional(),
  kategori: z.string().optional(),
  sumberDana: SumberDanaEnum.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

// Validasi Aset - pakai coerce biar string "1" dari form tetap valid
export const createAsetSchema = z.object({
  // Nomor aset opsional: bila kosong, server membuat AST-001, AST-002, dst.
  id: z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^AST-\d{3,}$/, "ID harus format AST-001 (contoh: AST-005)")
      .optional()
  ),
  namaAset: z.string().min(2, "Nama aset minimal 2 karakter").max(100).trim(),
  jumlah: z.coerce.number().int().min(1, "Jumlah minimal 1").default(1).optional(),
  kategori: z.enum(KATEGORI_ASET, { message: "Kategori harus dari daftar COA" }),
  kondisi: z.string().min(2, "Kondisi wajib diisi").max(50).trim(),
  status: z.enum(STATUS_ASET, { message: "Status harus dari daftar yang tersedia" }).default("Aktif").optional(),
  nilaiAset: z.coerce.number().positive("Nilai harus positif").min(1000, "Nilai minimal Rp 1.000").max(10_000_000_000, "Nilai terlalu besar").optional(),
  tanggalPerolehan: z.coerce.date().optional().nullable(),
  // --- Aset Tetap (form Tambah Aset) ---
  deskripsi: z.string().trim().max(1000, "Deskripsi maksimal 1000 karakter").optional().nullable(),
  tanggalAkuisisi: z.coerce.date({ message: "Tanggal akuisisi tidak valid" }),
  biayaAkuisisi: z.coerce.number().positive("Biaya harus positif").min(1000, "Biaya minimal Rp 1.000").max(10_000_000_000, "Biaya terlalu besar"),
  akunAset: z.string().trim().max(10, "Kode akun maksimal 10 karakter"),
  akunKredit: z.string().trim().max(10, "Kode akun maksimal 10 karakter"),
  tags: z.string().trim().max(200, "Tags maksimal 200 karakter").optional().nullable(),
  kreditur: z.string().trim().max(100, "Kreditur maksimal 100 karakter").optional().nullable(),
  jatuhTempo: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.date({ message: "Jatuh tempo tidak valid" }).optional().nullable()
  ),
  langsungAktif: z.coerce.boolean().optional().nullable(),
  // --- Penyusutan ---
  nonDepresiasi: z.coerce.boolean().optional().nullable(),
  metodeSusut: z.enum(["GARIS_LURUS", "SALDO_MENURUN"]).optional().nullable(),
  masaManfaatBulan: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().int("Masa manfaat harus bilangan bulan bulat").min(1, "Masa manfaat minimal 1 bulan").max(1200).optional().nullable()
  ),
  nilaiResidu: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().nonnegative("Nilai residu tidak boleh negatif").max(10_000_000_000).optional().nullable()
  ),
  akunBebanSusut: z.string().trim().max(10).optional().nullable(),
  akunAkumulasi: z.string().trim().max(100, "Akun akumulasi maksimal 100 karakter").optional().nullable(),
  tanggalMulaiSusut: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.date({ message: "Tanggal mulai penyusutan tidak valid" }).optional().nullable()
  ),
});

export const updateAsetSchema = z.object({
  namaAset: z.string().min(2).max(100).optional(),
  jumlah: z.coerce.number().int().min(1).optional(),
  kategori: z.enum(KATEGORI_ASET, { message: "Kategori harus dari daftar COA" }).optional(),
  kondisi: z.string().min(2).max(50).optional(),
  status: z.enum(STATUS_ASET, { message: "Status harus dari daftar yang tersedia" }).optional(),
  nilaiAset: z.coerce.number().positive().min(1000).max(10_000_000_000).optional(),
  biayaAkuisisi: z.coerce.number().positive("Biaya harus positif").min(1000, "Biaya minimal Rp 1.000").max(10_000_000_000, "Biaya terlalu besar").optional(),
  tanggalPerolehan: z.coerce.date().optional().nullable(),
  deskripsi: z.string().trim().max(1000).optional().nullable(),
  tags: z.string().trim().max(200).optional().nullable(),
  metodeSusut: z.enum(["NON_DEP", "GARIS_LURUS", "SALDO_MENURUN"]).optional().nullable(),
  masaManfaatBulan: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().int().min(1).max(1200).optional().nullable()
  ),
  nilaiResidu: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().nonnegative().max(10_000_000_000).optional().nullable()
  ),
  akunBebanSusut: z.string().trim().max(10).optional().nullable(),
  akunAkumulasi: z.string().trim().max(100).optional().nullable(),
  tanggalMulaiSusut: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.date().optional().nullable()
  ),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi",
});

// Jual / lepas aset aktif (dicatat, dengan jurnal akuntansi).
export const lepasAsetSchema = z.object({
  jenisPelepasan: z.enum(
    ["DIJUAL_SUDAH_DIBAYAR", "DIJUAL_BELUM_DIBAYAR", "DILEPAS_TANPA_PENJUALAN"],
    { message: "Jenis pelepasan harus dipilih" }
  ),
  tanggal: z.coerce.date({ message: "Tanggal tidak valid" }).optional().nullable(),
  hargaJual: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().nonnegative("Harga jual tidak boleh negatif").max(10_000_000_000).optional().nullable()
  ),
  akunPenerima: z.string().trim().max(10, "Kode akun maksimal 10 karakter").optional().nullable(),
  noTransaksi: z.string().trim().max(50, "No. transaksi maksimal 50 karakter").optional().nullable(),
  alasanPelepasan: z.string().trim().max(1000, "Alasan maksimal 1000 karakter").optional().nullable(),
  keterangan: z.string().trim().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
}).refine((data) => {
  if (data.jenisPelepasan === "DIJUAL_SUDAH_DIBAYAR" && !data.akunPenerima) {
    return false;
  }
  return true;
}, {
  message: "Akun penerima (Kas/Bank/Tabungan) wajib diisi untuk penjualan sudah dibayar",
  path: ["akunPenerima"],
}).refine((data) => {
  if ((data.jenisPelepasan === "DIJUAL_SUDAH_DIBAYAR" || data.jenisPelepasan === "DIJUAL_BELUM_DIBAYAR") && !(data.hargaJual && data.hargaJual > 0)) {
    return false;
  }
  return true;
}, {
  message: "Harga jual wajib diisi untuk penjualan aset",
  path: ["hargaJual"],
}).refine((data) => {
  if (data.jenisPelepasan === "DILEPAS_TANPA_PENJUALAN" && !data.alasanPelepasan) {
    return false;
  }
  return true;
}, {
  message: "Alasan pelepasan wajib diisi untuk dilepas tanpa penjualan",
  path: ["alasanPelepasan"],
});

// Konfirmasi pembayaran untuk penjualan belum dibayar.
export const konfirmasiPembayaranSchema = z.object({
  tanggalPembayaran: z.coerce.date({ message: "Tanggal pembayaran tidak valid" }).optional().nullable(),
  akunPenerima: z.string().trim().max(10, "Kode akun maksimal 10 karakter"),
  noTransaksi: z.string().trim().max(50, "No. transaksi maksimal 50 karakter").optional().nullable(),
  keterangan: z.string().trim().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
}).refine((data) => {
  const isKasBankTabungan = ["1101", "1103", "1104"].includes(data.akunPenerima.trim());
  if (!isKasBankTabungan) {
    return false;
  }
  return true;
}, {
  message: "Akun penerima harus Kas (1101) / Bank (1103) / Tabungan (1104)",
  path: ["akunPenerima"],
});

export type CreateTransaksiInput = z.infer<typeof createTransaksiKasSchema>;
export type UpdateTransaksiInput = z.infer<typeof updateTransaksiKasSchema>;
export type CreateAsetInput = z.infer<typeof createAsetSchema>;
export type BuktiTransaksiInput = z.infer<typeof createBuktiTransaksiSchema>;

// ---------- Biaya ----------

export const TipeBiayaEnum = z.enum(["TUNAI", "HUTANG"]);

export type TipeBiaya = z.infer<typeof TipeBiayaEnum>;

export const createBiayaSchema = z.object({
  tipe: TipeBiayaEnum,
  tanggal: z.coerce.date({ message: "Tanggal tidak valid" }),
  jatuhTempo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date({ message: "Jatuh tempo tidak valid" }).optional().nullable()
  ),
  kategori: z.string().min(2, "Kategori minimal 2 karakter").max(100).trim(),
  kodeAkun: z.string().trim().max(10, "Kode akun maksimal 10 karakter").optional().nullable(),
  penerima: z.string().min(2, "Penerima minimal 2 karakter").max(150).trim(),
  jumlah: z
    .number({ message: "Jumlah harus angka" })
    .positive("Jumlah harus positif")
    .min(1000, "Jumlah minimal Rp 1.000")
    .max(10_000_000_000, "Jumlah terlalu besar"),
  sumberDana: z.enum(["KAS", "BANK", "TABUNGAN"]).optional().nullable(),
  tags: z.string().trim().max(200, "Tags maksimal 200 karakter").optional().nullable(),
  memo: z.string().trim().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
  // Untuk menautkan Biaya ke TransaksiKas PENGELUARAN yang sudah ada (biaya tunai dari Kas & Bank)
  transaksiKasId: z.string().cuid("ID transaksi kas tidak valid").optional().nullable(),
}).refine(
  (data) => {
    if (data.tipe === "TUNAI") {
      if (!data.sumberDana) return false;
      // Jika transaksiKasId diisi, sumberDana diambil dari transaksi kas yang sudah ada
      if (data.transaksiKasId && data.sumberDana) return true;
      if (!data.transaksiKasId && data.sumberDana) return true;
    }
    if (data.tipe === "HUTANG") {
      if (!data.jatuhTempo) return false;
    }
    return true;
  },
  {
    message: "Field tidak lengkap untuk tipe biaya yang dipilih",
    path: ["tipe"],
  }
);

export type CreateBiayaInput = z.infer<typeof createBiayaSchema>;
