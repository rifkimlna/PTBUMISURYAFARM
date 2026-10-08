// Helper syarat pembayaran -> tanggal jatuh tempo otomatis.
// Aman dipakai Server maupun Client Component (fungsi murni, tanpa impor lain).

// "Tunai" -> 0 hari; "Tempo 7/14/30 hari" -> N hari; lainnya -> null (tidak otomatis).
export function tempoHari(syarat: string | null | undefined): number | null {
  const t = (syarat ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "tunai") return 0;
  const m = t.match(/tempo\s+(\d+)\s*hari/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 && n <= 3650 ? n : null;
}

function keYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Tambah N hari ke tanggal "YYYY-MM-DD" (parse sebagai tanggal lokal).
export function tambahHari(ymd: string, hari: number): string | null {
  const [y, m, d] = (ymd || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setDate(dt.getDate() + hari);
  return keYMD(dt);
}

// Tanggal jatuh tempo dari tanggal transaksi + syarat. Null bila tidak otomatis.
export function jatuhTempoDari(tanggalYMD: string, syarat: string | null | undefined): string | null {
  const hari = tempoHari(syarat);
  if (hari === null || !tanggalYMD) return null;
  return tambahHari(tanggalYMD, hari);
}
