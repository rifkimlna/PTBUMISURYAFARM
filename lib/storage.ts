/**
 * Helper Upload Foto Lapangan - Cloud Storage Integration
 *
 * Alur: Foto dari HP petugas -> upload ke Cloud Storage (UploadThing / Supabase / S3) -> dapat URL publik -> simpan fotoUrl ke DB
 *
 * File ini menyediakan abstraction agar mudah ganti provider tanpa ubah logic API.
 * Default: validasi file + simulasi upload (jika belum set env) atau integrasi Supabase/UploadThing.
 */

export type UploadResult = {
  url: string;
  key?: string;
  provider: string;
};

export type UploadOptions = {
  folder?: string; // ex: "riwayat-kesehatan"
  maxSizeMB?: number; // default 5
  allowedTypes?: string[]; // default image/*
};

const ALLOWED_MIME_DEFAULT = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_SIZE_DEFAULT_MB = 5;

// ========== Validasi File ==========
export function validateFile(file: File, opts: UploadOptions = {}) {
  const max = opts.maxSizeMB ?? MAX_SIZE_DEFAULT_MB;
  const allowed = opts.allowedTypes ?? ALLOWED_MIME_DEFAULT;

  if (!allowed.includes(file.type)) {
    throw new Error(`Tipe file tidak diizinkan: ${file.type}. Allowed: ${allowed.join(", ")}`);
  }
  if (file.size > max * 1024 * 1024) {
    throw new Error(`Ukuran file terlalu besar: ${(file.size / 1024 / 1024).toFixed(2)}MB > ${max}MB`);
  }
}

// ========== Provider: Supabase Storage ==========
// Aktif jika env SUPABASE_URL & SUPABASE_ANON_KEY & SUPABASE_BUCKET tersedia
async function uploadToSupabase(file: File, folder: string): Promise<UploadResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "pt-bst";

  if (!url || !key) throw new Error("Supabase env tidak lengkap");

  // Dynamic import agar tidak wajib install jika tidak pakai Supabase
  // npm install @supabase/supabase-js
  // @ts-ignore - optional dependency
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(filename, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return { url: data.publicUrl, key: filename, provider: "supabase" };
}

// ========== Provider: UploadThing ==========
// Aktif jika UPLOADTHING_TOKEN tersedia
async function uploadToUploadThing(file: File): Promise<UploadResult> {
  // Untuk integrasi real, gunakan uploadthing/server + UTApi
  // Contoh: const utapi = new UTApi(); const res = await utapi.uploadFiles(file);
  // Di sini kita provide stub yang bisa diaktifkan setelah install: npm install uploadthing
  throw new Error("UploadThing belum dikonfigurasi - install uploadthing dan set UPLOADTHING_TOKEN");
}

// ========== Fallback: Simulasi / Local (Dev) ==========
// Jika tidak ada provider cloud, return URL placeholder dan log warning
async function uploadSimulated(file: File, folder: string): Promise<UploadResult> {
  console.warn("[Storage] Tidak ada provider cloud dikonfigurasi - menggunakan simulated URL.");
  console.warn("Set SUPABASE_URL + SUPABASE_ANON_KEY atau UPLOADTHING_TOKEN di .env untuk upload real.");
  const ext = file.name.split(".").pop() || "jpg";
  const fakeUrl = `https://storage.pt-bst.example/${folder}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
  // Di production, throw error agar petugas tidak save fotoUrl palsu
  if (process.env.NODE_ENV === "production") {
    throw new Error("Storage belum dikonfigurasi untuk production");
  }
  return { url: fakeUrl, key: fakeUrl, provider: "simulated" };
}

// ========== Main API ==========
/**
 * Upload foto lapangan ke cloud dan kembalikan URL publik.
 * Akan otomatis pilih provider berdasarkan env yang tersedia.
 *
 * @param file - File dari FormData
 * @param opts - Opsi folder & validasi
 * @returns URL publik yang siap disimpan ke fotoUrl
 */
export async function uploadFotoLapangan(file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  validateFile(file, opts);
  const folder = opts.folder || "riwayat-kesehatan";

  // Prioritas: Supabase -> UploadThing -> Simulated
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      return await uploadToSupabase(file, folder);
    } catch (e) {
      console.error("[Storage] Supabase upload gagal, fallback:", e);
      // fallback ke simulated jika di dev
      if (process.env.NODE_ENV !== "production") return uploadSimulated(file, folder);
      throw e;
    }
  }

  if (process.env.UPLOADTHING_TOKEN) {
    return uploadToUploadThing(file);
  }

  return uploadSimulated(file, folder);
}

/**
 * Hapus file dari storage (optional)
 */
export async function deleteFotoLapangan(keyOrUrl: string): Promise<void> {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    // @ts-ignore - optional dependency
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const bucket = process.env.SUPABASE_BUCKET || "pt-bst";
    // Ekstrak key dari URL jika perlu
    const key = keyOrUrl.includes(bucket + "/") ? keyOrUrl.split(bucket + "/")[1] : keyOrUrl;
    await supabase.storage.from(bucket).remove([key]);
    return;
  }
  console.warn("[Storage] deleteFotoLapangan - no provider, skipped");
}

/**
 * Helper untuk route handler: parse FormData foto
 */
export async function parseFotoFromFormData(formData: FormData, field = "foto"): Promise<File | null> {
  const file = formData.get(field);
  if (!file || !(file instanceof File) || file.size === 0) return null;
  return file;
}
