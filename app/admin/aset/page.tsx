import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { AsetTable } from "@/components/admin/aset-table";

export default async function AsetPage() {
  const [aset, cookieStore] = await Promise.all([
    prisma.aset.findMany({ orderBy: { createdAt: "desc" } }),
    cookies(),
  ]);

  const token = cookieStore.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const canDelete = session?.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Inventaris Aset</h1>
        <p className="mt-1 text-sm text-slate-500">Daftar alat, traktor, dan gudang PT Bumi Surya Farm.</p>
      </div>
      <AsetTable
        initialData={aset.map((a) => ({
          id: a.id,
          namaAset: a.namaAset,
          jumlah: a.jumlah,
          kondisi: a.kondisi,
          nilaiAset: Number(a.nilaiAset),
        }))}
        canDelete={canDelete}
      />
    </div>
  );
}