import { z } from "zod";

export const TipeDokumenEnum = z.enum(["PENAWARAN", "PESANAN", "PROFORMA", "TUKAR_FAKTUR", "PENAGIHAN"]);
export type TipeDokumen = z.infer<typeof TipeDokumenEnum>;

// Jenis penjualan → akun pendapatan otomatis (COA PT BST):
// HASIL_KEBUN → 4101, TERNAK → 4102, IKAN → 4103, LAINNYA → 4104.
export const JenisPenjualanEnum = z.enum(["HASIL_KEBUN", "TERNAK", "IKAN", "LAINNYA"]);
export type JenisPenjualan = z.infer<typeof JenisPenjualanEnum>;

export const createPelangganSchema = z.object({
  nama: z.string().trim().min(2, "Nama pelanggan minimal 2 karakter").max(100),
  email: z.string().trim().max(100).optional().nullable(),
  telepon: z.string().trim().max(30, "Telepon maksimal 30 karakter").optional().nullable(),
  alamat: z.string().trim().max(1000, "Alamat maksimal 1000 karakter").optional().nullable(),
}).refine(
  (d) => !d.email || /.+@.+\..+/.test(d.email),
  { message: "Format email tidak valid", path: ["email"] }
);

export const lampiranDokumenSchema = z.object({
  fileName: z.string().min(1).max(200),
  fileUrl: z.string().min(1).max(500),
  fileType: z.string().max(100).optional(),
  fileSize: z.number().int().nonnegative().optional(),
});

export const itemDokumenSchema = z.object({
  produkId: z.string().max(50).optional().nullable(),
  deskripsi: z.string().trim().min(2, "Deskripsi produk minimal 2 karakter").max(500),
  kuantitas: z.number({ message: "Kuantitas harus angka" }).positive("Kuantitas harus positif").max(1_000_000_000),
  unit: z.string().trim().min(1, "Unit wajib diisi").max(20),
  harga: z.number({ message: "Harga harus angka" }).min(0, "Harga minimal 0").max(10_000_000_000),
  diskonPersen: z.number({ message: "Diskon harus angka" }).min(0).max(100).default(0),
});

export const baseDokumenSchema = z.object({
  tipe: TipeDokumenEnum,
  pelangganId: z.string().min(1, "Pelanggan wajib dipilih").max(50),
  // Jenis penjualan hanya dipakai PENAGIHAN (menentukan akun pendapatan otomatis).
  jenis: JenisPenjualanEnum.optional().nullable(),
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
  noRefPelanggan: z.string().trim().max(50).optional().nullable(),
  syaratPembayaran: z.string().trim().max(50).optional().nullable(),
  pesan: z.string().trim().max(1000).optional().nullable(),
  memo: z.string().trim().max(1000).optional().nullable(),
  items: z.array(itemDokumenSchema).max(50, "Maksimal 50 baris produk").default([]),
  referensiIds: z.array(z.string().max(50)).max(50).default([]),
  lampiran: z.array(lampiranDokumenSchema).max(20, "Maksimal 20 lampiran").optional(),
});

export const createDokumenSchema = baseDokumenSchema.superRefine((data, ctx) => {
  if (data.tipe === "TUKAR_FAKTUR") {
    if (data.referensiIds.length === 0) {
      ctx.addIssue({ code: "custom", message: "Pilih minimal 1 faktur/penagihan yang akan ditukar", path: ["referensiIds"] });
    }
  } else if (data.items.length === 0) {
    ctx.addIssue({ code: "custom", message: "Tambahkan minimal 1 baris produk", path: ["items"] });
  }
  if (data.tipe === "PENAGIHAN" && !data.jatuhTempo) {
    ctx.addIssue({ code: "custom", message: "Tanggal jatuh tempo wajib diisi", path: ["jatuhTempo"] });
  }
  if (data.tipe === "PENAGIHAN" && !data.jenis) {
    ctx.addIssue({ code: "custom", message: "Jenis penjualan wajib dipilih", path: ["jenis"] });
  }
  if (data.email && !/.+@.+\..+/.test(data.email)) {
    ctx.addIssue({ code: "custom", message: "Format email tidak valid", path: ["email"] });
  }
});

export type CreateDokumenInput = z.infer<typeof createDokumenSchema>;
export type CreatePelangganInput = z.infer<typeof createPelangganSchema>;

// Ubah field penagihan (bukan pembayaran). Semua opsional, minimal 1 diisi.
export const updatePenagihanSchema = z
  .object({
    pihak: z.string().trim().min(2, "Nama pelanggan minimal 2 karakter").max(100).optional(),
    keterangan: z.string().trim().max(1000).optional().nullable(),
    jatuhTempo: z.string().optional().nullable().transform((s) => {
      if (!s) return null;
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    }),
    noInvoice: z.string().trim().max(50, "No invoice maksimal 50 karakter").optional().nullable(),
    jenis: z.enum(["HASIL_KEBUN", "TERNAK", "IKAN", "LAINNYA"]).optional().nullable(),
    dokumen: z.enum(["PENAGIHAN", "PROFORMA", "TUKAR_FAKTUR"]).optional().nullable(),
    jumlah: z
      .number({ message: "Total harus angka" })
      .positive("Total harus positif")
      .min(1000, "Total minimal Rp 1.000")
      .max(10_000_000_000, "Total terlalu besar")
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Minimal satu field harus diisi" });

export type UpdatePenagihanInput = z.infer<typeof updatePenagihanSchema>;
