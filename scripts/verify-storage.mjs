// Verifikasi Supabase Storage dari lokal sebelum deploy.
// Cara pakai: isi SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (atau ANON_KEY)
// + SUPABASE_BUCKET di .env, lalu: npm run storage:verify
// Script ini TIDAK pernah mencetak isi secret, hanya status per langkah.

import "dotenv/config";

const RAW_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/(rest|auth|storage|realtime)\/v1$/, "");
const URL = RAW_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const KEY_NAME = process.env.SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY";
const BUCKET = process.env.SUPABASE_BUCKET || "pt-bst";

// PNG 1x1 transparan untuk file tes (kecil, valid image/png)
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

let failed = false;
function ok(msg) {
  console.log(`  [OK] ${msg}`);
}
function fail(msg) {
  failed = true;
  console.log(`  [GAGAL] ${msg}`);
}

console.log("== Verifikasi Supabase Storage ==");

// 1. Env
console.log("1. Cek env...");
if (!URL) fail("SUPABASE_URL belum diset di .env");
else ok(`SUPABASE_URL diset (${URL.length} char)`);
if (!KEY) fail("SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY belum diset di .env");
else ok(`${KEY_NAME} diset (${KEY.length} char)`);
console.log(`     Bucket target: ${BUCKET}`);
if (failed) {
  console.log("\nIsi dulu 3 var di atas di .env (lihat .env.example), lalu ulangi.");
  process.exit(1);
}

const base = URL.replace(/\/$/, "");
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const IS_ANON = !process.env.SUPABASE_SERVICE_ROLE_KEY;

// 2. Bucket ada? (anon key sering tidak boleh membaca metadata bucket,
// jadi 404 di sini belum tentu bucket tidak ada — tes upload yang menentukan)
console.log("2. Cek bucket...");
let bucketOk = false;
try {
  const r = await fetch(`${base}/storage/v1/bucket/${BUCKET}`, { headers });
  if (r.status === 200) {
    const b = await r.json();
    ok(`bucket "${BUCKET}" ada (public: ${b.public})`);
    if (!b.public) fail("bucket belum PUBLIC — set Public di dashboard agar <img> bisa buka");
    bucketOk = true;
  } else if ((r.status === 400 || r.status === 403 || r.status === 404) && IS_ANON) {
    // Catatan: dengan ANON_KEY, baris bucket yang tidak punya policy SELECT
    // di storage.buckets disembunyikan RLS sebagai 404 — belum tentu tidak ada.
    // Tes upload (langkah 3) adalah bukti sebenarnya. Lanjut.
    console.log(`  [INFO] metadata bucket tidak terbaca pakai ANON_KEY (HTTP ${r.status}) — wajar tanpa policy storage.buckets, lanjut ke tes upload sebagai bukti nyata.`);
    bucketOk = true;
  } else if (r.status === 404) {
    fail(`bucket "${BUCKET}" tidak ditemukan — buat dulu di Storage dengan nama persis itu`);
  } else {
    fail(`cek bucket -> HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
} catch (e) {
  fail(`tidak bisa hubungi Supabase: ${e.message}`);
}
if (failed) process.exit(1);

// 3. Upload file tes
const name = `verify/${Date.now()}-tes.png`;
console.log("3. Upload file tes...");
try {
  const r = await fetch(`${base}/storage/v1/object/${BUCKET}/${name}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "image/png", "x-upsert": "false" },
    body: TEST_PNG,
  });
  if (r.ok) ok(`upload berhasil: ${name}`);
  else fail(`upload -> HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
} catch (e) {
  fail(`upload error: ${e.message}`);
}
if (failed) process.exit(1);

// 4. URL publik bisa dibuka?
const publicUrl = `${base}/storage/v1/object/public/${BUCKET}/${name}`;
console.log("4. Cek URL publik...");
try {
  const r = await fetch(publicUrl);
  if (r.ok) ok(`publik bisa dibuka (HTTP 200): ${publicUrl}`);
  else fail(`URL publik -> HTTP ${r.status}. Cek bucket PUBLIC + policy SELECT. URL: ${publicUrl}`);
} catch (e) {
  fail(`cek URL publik error: ${e.message}`);
}

// 5. Bersihkan file tes
console.log("5. Hapus file tes...");
try {
  const r = await fetch(`${base}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [name] }),
  });
  if (r.ok) ok("file tes dihapus");
  else console.log(`  [INFO] hapus file tes -> HTTP ${r.status} (hapus manual bila perlu: ${name})`);
} catch (e) {
  console.log(`  [INFO] hapus file tes error: ${e.message}`);
}

console.log(failed ? "\nHASIL: GAGAL — perbaiki langkah bertanda [GAGAL] di atas." : "\nHASIL: SEMUA LOLOS — aman lanjut set env yang sama di Vercel + redeploy.");
process.exit(failed ? 1 : 0);
