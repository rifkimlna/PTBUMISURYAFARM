// Banner peringatan database tidak terhubung.
// Dipakai semua server page perkebunan: gagal koneksi DB tampil sebagai
// peringatan di halaman (bukan error boundary 500 "This page couldn't load").
// Penyebab umum di Vercel: DATABASE_URL belum diisi di Environment Variables.
export function DbErrorBanner() {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-3 sm:px-4 py-3">
      <div className="text-sm font-medium text-red-800">
        ⚠️ Database tidak terhubung. Cek DATABASE_URL di Vercel (Project Settings → Environment Variables) lalu redeploy.
      </div>
      <div className="mt-1 text-xs text-red-600">
        Data di bawah kosong karena koneksi database gagal — bukan data asli.
      </div>
    </div>
  );
}
