import { readFileSync } from "fs";
export function ensureTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  let dbName: string;
  try {
    const parsed = new URL(url);
    dbName = parsed.pathname.replace(/^\//, "");
  } catch {
    console.error("[TEST GUARD] DATABASE_URL tidak valid:", mask(url));
    process.exit(1);
  }
  if (dbName !== "pt_bst_test") {
    console.error("[TEST GUARD] Database test tidak terhubung. Nama database terdeteksi:", dbName);
    console.error("[TEST GUARD] Test dihentikan untuk mencegah perubahan ke database utama.");
    process.exit(1);
  }
  // Blokir nama db utama
  if (String(dbName) === "pt_bst") {
    console.error("[TEST GUARD] Terhubung ke database utama!");
    process.exit(1);
  }
}
function mask(u: string) {
  try {
    const p = new URL(u);
    p.password = "*****";
    return p.toString();
  } catch {
    return "***";
  }
}
