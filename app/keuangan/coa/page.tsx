import { Metadata } from "next";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { CoaList } from "@/components/admin/coa-list";
import { getAkunGroupedFromDB, KELOMPOK_URUTAN } from "@/lib/coa-server";

export const metadata: Metadata = {
  title: "Daftar Akun (COA) | PT Bumi Surya Farm",
};

export default async function CoaPage() {
  // Get user role from session
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const userRole = session?.role;

  const grouped = await getAkunGroupedFromDB();

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <CoaList grouped={grouped} kelompokUrutan={KELOMPOK_URUTAN} userRole={userRole} />
    </div>
  );
}