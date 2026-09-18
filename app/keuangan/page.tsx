import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { Building } from "lucide-react";
import { DashboardKeuangan } from "@/components/admin/dashboard-keuangan";

// Dashboard Keuangan PT BST — merangkum data nyata (Kas & Bank, Penjualan,
// Hutang & Piutang, COA). Tiap section punya filter periodenya sendiri.
export default async function KeuanganDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const userName = session?.nama ?? "Pengguna";

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Selamat Datang, {userName} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-400">Pantau kondisi keuangan PT Bumi Surya Farm dalam satu halaman.</p>
        </div>
        <div className="flex items-center justify-center sm:justify-end">
          <Building className="h-12 w-12 text-emerald-700 opacity-30" aria-hidden="true" />
        </div>
      </div>

      <DashboardKeuangan />
    </div>
  );
}
