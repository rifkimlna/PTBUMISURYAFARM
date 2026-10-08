import { z } from "zod";

export const createSupplierSchema = z.object({
  nama: z.string().trim().min(2, "Nama supplier minimal 2 karakter").max(100),
  email: z.string().trim().max(100).optional().nullable(),
  telepon: z.string().trim().max(30, "Telepon maksimal 30 karakter").optional().nullable(),
  alamat: z.string().trim().max(1000, "Alamat maksimal 1000 karakter").optional().nullable(),
}).refine(
  (d) => !d.email || /.+@.+\..+/.test(d.email),
  { message: "Format email tidak valid", path: ["email"] }
);

export const lampiranFakturSchema = z.object({
  fileName: z.string().min(1).max(200),
  fileUrl: z.string().min(1).max(500),
  fileType: z.string().max(100).optional(),
  fileSize: z.number().int().nonnegative().optional(),
});

// Baris item faktur: kodeAkun = sisi DEBIT baris ini.
// - Produk persediaan: 1105/1106/1107 (diisi otomatis dari master, boleh dikoreksi).
// - Selain itu: wajib pilih akun Beban dari COA database.
export const itemFakturSchema = z.object({
  produkId: z.string().max(50).optional().nullable(),
  deskripsi: z.string().trim().min(2, "Deskripsi produk minimal 2 karakter").max(500),
  kuantitas: z.number({ message: "Kuantitas harus angka" }).positive("Kuantitas harus positif").max(1_000_000_000),
  unit: z.string().trim().min(1, "Unit wajib diisi").max(20),
  harga: z.number({ message: "Harga harus angka" }).min(0, "Harga minimal 0").max(10_000_000_000),
  diskonPersen: z.number({ message: "Diskon harus angka" }).min(0).max(100).default(0),
  kodeAkun: z.string().trim().max(10).optional().nullable(),
});

export const baseFakturSchema = z.object({
  supplierId: z.string().min(1, "Supplier wajib dipilih").max(50),
  email: z.string().trim().max(100).optional().nullable(),
  alamat: z.string().trim().max(1000).optional().nullable(),
  tanggal: z.coerce.date().optional(),
  jatuhTempo: z.coerce.date().optional().nullable(),
  noRefSupplier: z.string().trim().max(50).optional().nullable(),
  syaratPembayaran: z.string().trim().max(50).optional().nullable(),
  gudang: z.string().trim().max(100).optional().nullable(),
  tag: z.string().trim().max(100).optional().nullable(),
  pesan: z.string().trim().max(1000).optional().nullable(),
  memo: z.string().trim().max(1000).optional().nullable(),
  items: z.array(itemFakturSchema).min(1, "Tambahkan minimal 1 baris produk").max(50, "Maksimal 50 baris produk"),
  lampiran: z.array(lampiranFakturSchema).max(20, "Maksimal 20 lampiran").optional(),
});

export const createFakturSchema = baseFakturSchema.superRefine((data, ctx) => {
  if (!data.jatuhTempo) {
    ctx.addIssue({ code: "custom", message: "Tanggal jatuh tempo wajib diisi", path: ["jatuhTempo"] });
  }
  if (data.email && !/.+@.+\..+/.test(data.email)) {
    ctx.addIssue({ code: "custom", message: "Format email tidak valid", path: ["email"] });
  }
});

export type CreateFakturInput = z.infer<typeof createFakturSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

// Rantai dokumen pembelian: PERMINTAAN -> PENAWARAN -> PESANAN (PO).
// Tanpa jurnal keuangan (utang baru terbentuk saat Faktur dibuat).
export const TipeDokumenBeliEnum = z.enum(["PERMINTAAN", "PENAWARAN", "PESANAN"]);
export type TipeDokumenBeli = z.infer<typeof TipeDokumenBeliEnum>;

export const itemDokumenBeliSchema = z.object({
  produkId: z.string().max(50).optional().nullable(),
  deskripsi: z.string().trim().min(2, "Deskripsi produk minimal 2 karakter").max(500),
  kuantitas: z.number({ message: "Kuantitas harus angka" }).positive("Kuantitas harus positif").max(1_000_000_000),
  unit: z.string().trim().min(1, "Unit wajib diisi").max(20),
  harga: z.number({ message: "Harga harus angka" }).min(0, "Harga minimal 0").max(10_000_000_000),
  diskonPersen: z.number({ message: "Diskon harus angka" }).min(0).max(100).default(0),
  kodeAkun: z.string().trim().max(10).optional().nullable(),
});

export const baseDokumenBeliSchema = z.object({
  tipe: TipeDokumenBeliEnum,
  supplierId: z.string().max(50).optional().nullable(),
  departemen: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().max(100).optional().nullable(),
  alamat: z.string().trim().max(1000).optional().nullable(),
  tanggal: z.string().optional().transform((s) => {
    if (!s) return undefined;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }),
  jatuhTempo: z.string().optional().nullable().transform((s) => {
    if (!s) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }),
  noRefSupplier: z.string().trim().max(50).optional().nullable(),
  syaratPembayaran: z.string().trim().max(50).optional().nullable(),
  gudang: z.string().trim().max(100).optional().nullable(),
  pesan: z.string().trim().max(1000).optional().nullable(),
  memo: z.string().trim().max(1000).optional().nullable(),
  items: z.array(itemDokumenBeliSchema).max(50, "Maksimal 50 baris produk").default([]),
  referensiIds: z.array(z.string().max(50)).max(50).default([]),
  lampiran: z.array(lampiranFakturSchema).max(20, "Maksimal 20 lampiran").optional(),
});

export const createDokumenBeliSchema = baseDokumenBeliSchema.superRefine((data, ctx) => {
  if (data.tipe !== "PERMINTAAN" && !data.supplierId) {
    ctx.addIssue({ code: "custom", message: "Supplier wajib dipilih", path: ["supplierId"] });
  }
  if (data.items.length === 0) {
    ctx.addIssue({ code: "custom", message: "Tambahkan minimal 1 baris produk", path: ["items"] });
  }
  if (data.email && !/.+@.+\..+/.test(data.email)) {
    ctx.addIssue({ code: "custom", message: "Format email tidak valid", path: ["email"] });
  }
});

export type CreateDokumenBeliInput = z.infer<typeof createDokumenBeliSchema>;
