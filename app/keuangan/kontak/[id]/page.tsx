export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { saldoForKontak, saldoKontakMap } from "@/lib/kontak-saldo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupiah } from "@/lib/utils";
import { TIPE_KONTAK_LABEL, STATUS_KERJA_LABEL } from "@/components/admin/kontak-form";
import { EditKontakButton, kontakDetailToForm } from "@/components/admin/kontak-edit-dialog";

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Halaman Detail Kontak: master + riwayat transaksi nyata.
// - PELANGGAN: Dokumen Penjualan + Pengiriman + Tagihan PIUTANG (pihak = nama).
// - SUPPLIER: Faktur/Dokumen/Pengiriman Pembelian + Tagihan HUTANG.
// - KARYAWAN: data karyawan + gaji terakhir (arsip) + Biaya penerima = nama.
// Tagihan.pihak & Biaya.penerima adalah snapshot nama saat dibuat, jadi
// pencocokan memakai mode insensitive + fallback relasi Pelanggan/Supplier.
export default async function DetailKontakPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [kontak, saldoMap] = await Promise.all([
    prisma.kontak.findUnique({ where: { id } }),
    saldoKontakMap(),
  ]);
  if (!kontak) notFound();

  const saldo = saldoForKontak(saldoMap, kontak.tipe, kontak.nama);
  const namaMatch = { equals: kontak.nama.trim(), mode: "insensitive" as const };

  // Pasangan Penjualan/Pembelian (hasil sinkron dua arah).
  const [pelanggan, supplier, arsipKaryawan] = await Promise.all([
    kontak.tipe === "PELANGGAN"
      ? prisma.pelanggan.findFirst({ where: { nama: namaMatch }, select: { id: true, nama: true } })
      : Promise.resolve(null),
    kontak.tipe === "SUPPLIER"
      ? prisma.supplier.findFirst({ where: { nama: namaMatch }, select: { id: true, nama: true } })
      : Promise.resolve(null),
    // Arsip Karyawan lama (baca saja) untuk Gaji Terakhir. Ditautkan via
    // kodeKaryawan; Kontak tetap satu-satunya sumber tulis.
    kontak.tipe === "KARYAWAN" && kontak.kodeKaryawan
      ? prisma.karyawan.findUnique({
          where: { id: kontak.kodeKaryawan },
          include: { riwayatGaji: { orderBy: { bulanTahun: "desc" }, take: 1 } },
        })
      : Promise.resolve(null),
  ]);
  const gajiTerakhir = arsipKaryawan?.riwayatGaji[0] ?? null;

  // Riwayat per tipe (dibatasi 50 baris terbaru agar ringan).
  const [dokJual, kirimJual, tagihanJual, fakturBeli, dokBeli, kirimBeli, tagihanBeli, biaya] =
    await Promise.all([
      kontak.tipe === "PELANGGAN" && pelanggan
        ? prisma.dokumenPenjualan.findMany({
            where: { pelangganId: pelanggan.id },
            orderBy: { tanggal: "desc" },
            take: 50,
            select: { id: true, tipe: true, noDokumen: true, tanggal: true, status: true, total: true },
          })
        : Promise.resolve([]),
      kontak.tipe === "PELANGGAN" && pelanggan
        ? prisma.pengirimanPenjualan.findMany({
            where: { pelangganId: pelanggan.id },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: { id: true, noPengiriman: true, createdAt: true },
          })
        : Promise.resolve([]),
      kontak.tipe === "PELANGGAN"
        ? prisma.tagihan.findMany({
            where: { tipe: "PIUTANG", pihak: namaMatch },
            orderBy: { tanggal: "desc" },
            take: 50,
            select: { id: true, noInvoice: true, tanggal: true, jatuhTempo: true, status: true, jumlah: true, sisa: true },
          })
        : Promise.resolve([]),
      kontak.tipe === "SUPPLIER" && supplier
        ? prisma.fakturPembelian.findMany({
            where: { supplierId: supplier.id },
            orderBy: { tanggal: "desc" },
            take: 50,
            select: { id: true, noFaktur: true, tanggal: true, total: true, tagihan: { select: { status: true, sisa: true } } },
          })
        : Promise.resolve([]),
      kontak.tipe === "SUPPLIER" && supplier
        ? prisma.dokumenPembelian.findMany({
            where: { supplierId: supplier.id },
            orderBy: { tanggal: "desc" },
            take: 50,
            select: { id: true, tipe: true, noDokumen: true, tanggal: true, status: true, total: true },
          })
        : Promise.resolve([]),
      kontak.tipe === "SUPPLIER" && supplier
        ? prisma.pengirimanPembelian.findMany({
            where: { supplierId: supplier.id },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: { id: true, noPengiriman: true, createdAt: true },
          })
        : Promise.resolve([]),
      kontak.tipe === "SUPPLIER"
        ? prisma.tagihan.findMany({
            where: { tipe: "HUTANG", pihak: namaMatch },
            orderBy: { tanggal: "desc" },
            take: 50,
            select: { id: true, noInvoice: true, tanggal: true, jatuhTempo: true, status: true, jumlah: true, sisa: true },
          })
        : Promise.resolve([]),
      prisma.biaya.findMany({
        where: { penerima: namaMatch },
        orderBy: { tanggal: "desc" },
        take: 50,
        select: { id: true, noBiaya: true, tanggal: true, kategori: true, status: true, jumlah: true, sisa: true },
      }),
    ]);

  const totalTagihan = [...tagihanJual, ...tagihanBeli].reduce((s, t) => s + Number(t.jumlah), 0);
  const sisaTerbuka = [...tagihanJual, ...tagihanBeli]
    .filter((t) => t.status !== "LUNAS")
    .reduce((s, t) => s + Number(t.sisa), 0);
  const jumlahDokumen =
    dokJual.length + fakturBeli.length + dokBeli.length + kirimJual.length + kirimBeli.length;

  const tipeLabel = TIPE_KONTAK_LABEL[kontak.tipe as keyof typeof TIPE_KONTAK_LABEL] ?? kontak.tipe;
  const tipeVariant =
    kontak.tipe === "PELANGGAN"
      ? ("sehat" as const)
      : kontak.tipe === "SUPPLIER"
        ? ("info" as const)
        : kontak.tipe === "KARYAWAN"
          ? ("warning" as const)
          : ("secondary" as const);

  const rows: Array<{ label: string; value: string }> = [
    { label: "Tipe", value: tipeLabel },
    ...(kontak.tipe === "KARYAWAN"
      ? [
          { label: "ID Karyawan", value: kontak.kodeKaryawan ?? "—" },
          { label: "Jabatan", value: kontak.jabatan ?? "—" },
          {
            label: "Status pekerja",
            value: kontak.statusKerja
              ? (STATUS_KERJA_LABEL[kontak.statusKerja as keyof typeof STATUS_KERJA_LABEL] ?? kontak.statusKerja)
              : "—",
          },
          { label: "Lokasi kerja", value: kontak.lokasiKerja ?? "—" },
          { label: "Tanggal masuk", value: formatDate(kontak.tanggalMasuk) },
          {
            label: "Gaji pokok",
            value: kontak.gajiPokok == null ? "—" : `Rp ${formatRupiah(Number(kontak.gajiPokok))}`,
          },
          {
            label: "Gaji terakhir",
            value: gajiTerakhir
              ? `Rp ${formatRupiah(Number(gajiTerakhir.totalGaji))} · ${gajiTerakhir.bulanTahun} · ${gajiTerakhir.status.replaceAll("_", " ")}`
              : kontak.gajiPokok == null
                ? "Belum ada riwayat gaji"
                : `Rp ${formatRupiah(Number(kontak.gajiPokok))} (gaji pokok, belum ada riwayat)`,
          },
          { label: "Tanggal lahir", value: formatDate(kontak.tanggalLahir) },
          { label: "Jenis kelamin", value: kontak.jenisKelamin ? kontak.jenisKelamin.replaceAll("_", " ") : "—" },
        ]
      : []),
    { label: "Nama perusahaan", value: kontak.perusahaan ?? "—" },
    { label: "Email", value: kontak.email ?? "—" },
    { label: "No. handphone", value: kontak.noHp ?? "—" },
    { label: "No. telepon", value: kontak.noTelepon ?? "—" },
    { label: "Alamat", value: kontak.alamat ?? "—" },
    { label: "Catatan", value: kontak.catatan ?? "—" },
    {
      label: "Saldo",
      value:
        saldo === null
          ? "—"
          : `Rp ${formatRupiah(saldo)}${
              kontak.tipe === "PELANGGAN"
                ? " (sisa piutang terbuka)"
                : " (sisa utang terbuka)"
            }`,
    },
  ];

  const statusBadge = (st: string) => (
    <Badge variant={st === "LUNAS" || st === "SELESAI" ? "sehat" : st === "LUNAS_SEBAGIAN" ? "warning" : "secondary"}>
      {st.replaceAll("_", " ")}
    </Badge>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/keuangan/kontak"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Kontak
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{kontak.nama}</h1>
          <p className="mt-1 text-sm text-slate-400">
            <Badge variant={tipeVariant}>{tipeLabel}</Badge>
            {kontak.tipe === "PELANGGAN" && !pelanggan && (
              <span className="ml-2 text-xs text-amber-600">Belum ada data Pelanggan di Penjualan</span>
            )}
            {kontak.tipe === "SUPPLIER" && !supplier && (
              <span className="ml-2 text-xs text-amber-600">Belum ada data Supplier di Pembelian</span>
            )}
          </p>
        </div>
        <EditKontakButton
          kontak={{
            id: kontak.id,
            ...kontakDetailToForm({
              nama: kontak.nama,
              tipe: kontak.tipe as "PELANGGAN" | "SUPPLIER" | "KARYAWAN",
              perusahaan: kontak.perusahaan,
              email: kontak.email,
              noHp: kontak.noHp,
              noTelepon: kontak.noTelepon,
              alamat: kontak.alamat,
              catatan: kontak.catatan,
              kodeKaryawan: kontak.kodeKaryawan,
              jabatan: kontak.jabatan,
              statusKerja: kontak.statusKerja,
              lokasiKerja: kontak.lokasiKerja,
              tanggalMasuk: kontak.tanggalMasuk?.toISOString() ?? null,
              gajiPokok: kontak.gajiPokok == null ? null : Number(kontak.gajiPokok),
              tanggalLahir: kontak.tanggalLahir?.toISOString() ?? null,
              jenisKelamin: kontak.jenisKelamin,
            }),
          }}
        />
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">Detail Kontak</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className={r.label === "Alamat" || r.label === "Catatan" ? "sm:col-span-2" : ""}>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">{r.label}</div>
              <div className="mt-0.5 text-sm text-slate-700 whitespace-pre-line">{r.value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Ringkasan transaksi dari Penjualan / Pembelian / Biaya */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Total tagihan</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">Rp {formatRupiah(totalTagihan)}</div>
            <div className="mt-0.5 text-xs text-slate-400">
              {kontak.tipe === "PELANGGAN" ? "Piutang" : kontak.tipe === "SUPPLIER" ? "Utang" : "Hutang & Piutang"} atas nama ini
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Sisa terbuka</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">Rp {formatRupiah(sisaTerbuka)}</div>
            <div className="mt-0.5 text-xs text-slate-400">Belum lunas + lunas sebagian</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Dokumen & pengiriman</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">{jumlahDokumen}</div>
            <div className="mt-0.5 text-xs text-slate-400">Dari modul Penjualan / Pembelian</div>
          </CardContent>
        </Card>
      </div>

      {/* Tagihan terkait */}
      {(tagihanJual.length > 0 || tagihanBeli.length > 0) && (
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base">
              {kontak.tipe === "SUPPLIER" ? "Utang" : "Piutang"} atas nama ini
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. invoice</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jatuh tempo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...tagihanJual, ...tagihanBeli].map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm font-medium">{t.noInvoice ?? `…${t.id.slice(-6).toUpperCase()}`}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(t.tanggal)}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(t.jatuhTempo)}</TableCell>
                      <TableCell>{statusBadge(t.status)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">Rp {formatRupiah(Number(t.sisa))}</TableCell>
                      <TableCell className="text-right text-sm text-slate-500">Rp {formatRupiah(Number(t.jumlah))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dokumen penjualan */}
      {dokJual.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base">Dokumen Penjualan</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. dokumen</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dokJual.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Link href={`/keuangan/penjualan/${d.tipe.toLowerCase().replace("_", "-")}/${d.id}`} className="text-sm font-medium text-slate-900 underline decoration-dotted hover:text-green-700">
                          {d.noDokumen}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{d.tipe.replaceAll("_", " ")}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(d.tanggal)}</TableCell>
                      <TableCell>{statusBadge(d.status)}</TableCell>
                      <TableCell className="text-right text-sm">Rp {formatRupiah(Number(d.total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Faktur & dokumen pembelian */}
      {(fakturBeli.length > 0 || dokBeli.length > 0) && (
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base">Faktur & Dokumen Pembelian</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. dokumen</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fakturBeli.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <Link href={`/keuangan/pembelian/faktur/${f.id}`} className="text-sm font-medium text-slate-900 underline decoration-dotted hover:text-green-700">
                          {f.noFaktur}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">FAKTUR</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(f.tanggal)}</TableCell>
                      <TableCell>{statusBadge(f.tagihan?.status ?? "BELUM_LUNAS")}</TableCell>
                      <TableCell className="text-right text-sm">Rp {formatRupiah(Number(f.total))}</TableCell>
                    </TableRow>
                  ))}
                  {dokBeli.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm font-medium">{d.noDokumen}</TableCell>
                      <TableCell className="text-xs text-slate-500">{d.tipe}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(d.tanggal)}</TableCell>
                      <TableCell>{statusBadge(d.status)}</TableCell>
                      <TableCell className="text-right text-sm">Rp {formatRupiah(Number(d.total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pengiriman */}
      {(kirimJual.length > 0 || kirimBeli.length > 0) && (
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base">Pengiriman</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. pengiriman</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...kirimJual, ...kirimBeli].map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm font-medium">{p.noPengiriman}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(p.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Biaya */}
      {biaya.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base">Biaya atas nama ini</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. biaya</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {biaya.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-sm font-medium">{b.noBiaya}</TableCell>
                      <TableCell className="text-xs text-slate-500">{b.kategori}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(b.tanggal)}</TableCell>
                      <TableCell>{statusBadge(b.status)}</TableCell>
                      <TableCell className="text-right text-sm">Rp {formatRupiah(Number(b.jumlah))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {totalTagihan === 0 && jumlahDokumen === 0 && biaya.length === 0 && (
        <Card className="border-dashed border-slate-200">
          <CardContent className="p-6 text-center text-sm text-slate-400">
            Belum ada transaksi Penjualan, Pembelian, atau Biaya atas nama kontak ini.
            {kontak.tipe === "PELANGGAN" && !pelanggan && " Tambahkan pelanggan ini di form Penjualan, atau sinkronkan dari halaman Kontak."}
            {kontak.tipe === "SUPPLIER" && !supplier && " Tambahkan supplier ini di form Pembelian, atau sinkronkan dari halaman Kontak."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
