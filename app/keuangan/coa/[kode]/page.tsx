import { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoaDetail } from "@/components/admin/coa-detail";
import { getAkunByKodeFromDB } from "@/lib/coa-server";
import { getTransaksiAkun } from "@/lib/coa-transaksi";

interface PageProps {
  params: Promise<{ kode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { kode } = await params;
  const akun = await getAkunByKodeFromDB(kode);
  if (!akun) return { title: "Akun Tidak Ditemukan" };
  return { title: `${akun.kode} - ${akun.nama} | COA | PT Bumi Surya Farm` };
}

export default async function CoaDetailPage({ params }: PageProps) {
  const { kode } = await params;
  const akun = await getAkunByKodeFromDB(kode);
  if (!akun) notFound();

  // Fetch initial data (page 1, no date filter) — satu sumber dengan API
  // riwayatnya, sudah transfer-aware untuk akun Kas/Bank/Tabungan.
  const { rows, total, summary } = await getTransaksiAkun(kode, { page: 1, limit: 10 });

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <CoaDetail
        akun={akun}
        initialData={rows.map((d) => ({
          id: d.id,
          tanggal: d.tanggal,
          transaksi: d.transaksi,
          noTransaksi: d.noTransaksi,
          debit: d.debit,
          kredit: d.kredit,
          saldo: d.saldo,
        }))}
        initialTotal={total}
        initialSummary={summary}
      />
    </div>
  );
}
