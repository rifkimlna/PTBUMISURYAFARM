"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus, Search, ContactRound, X, RefreshCw } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  TIPE_KONTAK_LABEL,
  STATUS_KERJA_LABEL,
  emptyKontakForm,
  kontakPayload,
  KontakFormFields,
  type TipeKontak,
} from "@/components/admin/kontak-form";

export type KontakRow = {
  id: string;
  nama: string;
  tipe: TipeKontak;
  perusahaan: string | null;
  email: string | null;
  noHp: string | null;
  noTelepon: string | null;
  alamat: string | null;
  catatan: string | null;
  createdAt: string;
  // Khusus Karyawan (null untuk tipe lain)
  kodeKaryawan: string | null;
  jabatan: string | null;
  statusKerja: string | null;
  lokasiKerja: string | null;
  tanggalMasuk: string | null;
  gajiPokok: number | null;
  tanggalLahir: string | null;
  jenisKelamin: string | null;
  // Sisa tagihan terbuka (dari data Tagihan nyata). null = tidak berlaku
  // untuk tipe Karyawan (tanpa kolom Saldo).
  saldo: number | null;
};

type TabKey = TipeKontak | "SEMUA";

const TABS: TabKey[] = ["PELANGGAN", "SUPPLIER", "KARYAWAN", "SEMUA"];

const TIPE_BADGE: Record<TipeKontak, "sehat" | "info" | "warning"> = {
  PELANGGAN: "sehat",
  SUPPLIER: "info",
  KARYAWAN: "warning",
};

const STATUS_BADGE: Record<string, "sehat" | "perhatian" | "secondary"> = {
  TETAP: "sehat",
  TIDAK_TETAP: "perhatian",
  PENDUKUNG: "secondary",
};

function dash(value: string | null) {
  return value && value.trim() !== "" ? value : "—";
}

function formatTanggal(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function statusKerjaLabel(value: string | null) {
  if (!value) return "—";
  return (STATUS_KERJA_LABEL as Record<string, string>)[value] ?? value.replaceAll("_", " ");
}

export function KontakContent({ data }: { data: KontakRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("PELANGGAN");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"nama" | "terbaru">("nama");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyKontakForm("PELANGGAN"));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { PELANGGAN: 0, SUPPLIER: 0, KARYAWAN: 0, SEMUA: data.length };
    for (const r of data) {
      if (r.tipe === "PELANGGAN" || r.tipe === "SUPPLIER" || r.tipe === "KARYAWAN") c[r.tipe] += 1;
    }
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = data.filter((r) => {
      if (tab !== "SEMUA" && r.tipe !== tab) return false;
      if (q) {
        const hay = `${r.nama} ${r.perusahaan ?? ""} ${r.email ?? ""} ${r.noHp ?? ""} ${r.kodeKaryawan ?? ""} ${r.jabatan ?? ""} ${r.lokasiKerja ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) =>
      sort === "nama" ? a.nama.localeCompare(b.nama, "id") : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [data, tab, search, sort]);

  const openCreate = () => {
    setForm(emptyKontakForm(tab === "SEMUA" ? "PELANGGAN" : tab));
    setMessage("");
    setDialogOpen(true);
  };

  const saveKontak = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/kontak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kontakPayload(form)),
      });
      const result = await response.json().catch(() => ({ message: "Gagal menyimpan kontak" }));
      if (!response.ok) {
        const detail = Array.isArray((result as { errors?: { message: string }[] }).errors)
          ? (result as { errors: { message: string }[] }).errors.map((x) => x.message).join("; ")
          : null;
        throw new Error(detail || result.message || "Gagal menyimpan kontak");
      }
      setDialogOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan kontak");
    } finally {
      setSaving(false);
    }
  };

  const syncKontak = async () => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch("/api/kontak/sync", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Gagal sinkron kontak");
      setSyncMessage(result.message || "Sinkron selesai");
      router.refresh();
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Gagal sinkron kontak");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kontak</h1>
          <p className="mt-1 text-sm text-slate-400">Kelola pelanggan, supplier, dan karyawan.</p>
          {syncMessage && <p className="mt-1 text-xs text-slate-500">{syncMessage}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={syncKontak} disabled={syncing} className="w-fit cursor-pointer" title="Tarik pelanggan dari Penjualan & supplier dari Pembelian yang belum ada di Kontak">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Menyinkron..." : "Sinkronkan"}
          </Button>
          <Button type="button" onClick={openCreate} className="w-fit cursor-pointer">
            <Plus className="h-4 w-4" /> Buat Kontak
          </Button>
        </div>
      </div>

      <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-medium">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 transition-colors cursor-pointer ${
              tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t === "SEMUA" ? "Semua" : TIPE_KONTAK_LABEL[t]} · {counts[t]}
          </button>
        ))}
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kontak"
                aria-label="Cari kontak"
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  title="Bersihkan pencarian"
                  aria-label="Bersihkan pencarian"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={sort} onChange={(e) => setSort(e.target.value as "nama" | "terbaru")} className="sm:max-w-56" aria-label="Filter kontak">
              <option value="nama">Nama A–Z</option>
              <option value="terbaru">Terbaru</option>
            </Select>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 p-3 md:hidden">
            {filtered.length === 0 ? (
              <KontakEmpty hasData={data.length > 0} />
            ) : tab === "KARYAWAN" ? (
              filtered.map((k) => (
                <div key={k.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-slate-900">{dash(k.kodeKaryawan)}</div>
                    <Link href={`/keuangan/kontak/${k.id}`} className="text-sm font-medium text-slate-900 underline decoration-dotted hover:text-green-700">
                      {k.nama}
                    </Link>
                    <div className="text-xs text-slate-500">{dash(k.jabatan)} • {statusKerjaLabel(k.statusKerja)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-400">Lokasi</div>
                      <div className="font-medium truncate">{dash(k.lokasiKerja)}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-400">Masuk</div>
                      <div className="font-medium">{formatTanggal(k.tanggalMasuk)}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 col-span-2">
                      <div className="text-[11px] text-slate-400">Kontak</div>
                      <div className="font-medium truncate">{dash(k.noHp)} • {dash(k.email)}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 col-span-2">
                      <div className="text-[11px] text-emerald-700">Gaji Pokok</div>
                      <div className="font-semibold text-emerald-900">{k.gajiPokok == null ? "—" : `Rp ${formatRupiah(k.gajiPokok)}`}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              filtered.map((k) => (
                <div key={k.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/keuangan/kontak/${k.id}`} className="text-sm font-medium text-slate-900 underline decoration-dotted hover:text-green-700">
                        {k.nama}
                      </Link>
                      <div className="text-xs text-slate-500">{dash(k.perusahaan)}</div>
                    </div>
                    {tab === "SEMUA" && <Badge variant={TIPE_BADGE[k.tipe]}>{TIPE_KONTAK_LABEL[k.tipe]}</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-400">No. Handphone</div>
                      <div className="font-medium">{dash(k.noHp)}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-400">Saldo</div>
                      <div className="font-semibold">{k.saldo === null ? "—" : `Rp ${formatRupiah(k.saldo)}`}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 truncate">{dash(k.email)}</div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            {tab === "KARYAWAN" ? (
              <div className="min-w-[980px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Jabatan</TableHead>
                      <TableHead>Status Pekerja</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Telepon</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tanggal Masuk</TableHead>
                      <TableHead className="text-right">Gaji</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8">
                          <KontakEmpty hasData={data.length > 0} />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((k) => (
                        <TableRow key={k.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{dash(k.kodeKaryawan)}</TableCell>
                          <TableCell>
                            <Link href={`/keuangan/kontak/${k.id}`} className="text-sm font-medium text-slate-900 underline decoration-dotted hover:text-green-700">
                              {k.nama}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm max-w-[160px] truncate" title={k.jabatan ?? ""}>{dash(k.jabatan)}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_BADGE[k.statusKerja ?? ""] ?? "secondary"}>{statusKerjaLabel(k.statusKerja)}</Badge>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{dash(k.lokasiKerja)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{dash(k.noHp)}</TableCell>
                          <TableCell className="text-sm max-w-[180px] truncate" title={k.email ?? ""}>{dash(k.email)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{formatTanggal(k.tanggalMasuk)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold whitespace-nowrap">
                            {k.gajiPokok == null ? <span className="font-normal text-slate-300">—</span> : `Rp ${formatRupiah(k.gajiPokok)}`}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : tab === "SEMUA" ? (
              <div className="min-w-[920px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Nama Perusahaan</TableHead>
                      <TableHead>Alamat</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>No. Handphone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8">
                          <KontakEmpty hasData={data.length > 0} />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((k) => (
                        <TableRow key={k.id}>
                          <TableCell>
                            <Link href={`/keuangan/kontak/${k.id}`} className="text-sm font-medium text-slate-900 underline decoration-dotted hover:text-green-700">
                              {k.nama}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant={TIPE_BADGE[k.tipe]}>{TIPE_KONTAK_LABEL[k.tipe]}</Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate" title={k.perusahaan ?? ""}>{dash(k.perusahaan)}</TableCell>
                          <TableCell className="text-sm max-w-[220px] truncate" title={k.alamat ?? ""}>{dash(k.alamat)}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate" title={k.email ?? ""}>{dash(k.email)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{dash(k.noHp)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="min-w-[860px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Nama Perusahaan</TableHead>
                      <TableHead>Alamat</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>No. Handphone</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8">
                          <KontakEmpty hasData={data.length > 0} />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((k) => (
                        <TableRow key={k.id}>
                          <TableCell>
                            <Link href={`/keuangan/kontak/${k.id}`} className="text-sm font-medium text-slate-900 underline decoration-dotted hover:text-green-700">
                              {k.nama}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate" title={k.perusahaan ?? ""}>{dash(k.perusahaan)}</TableCell>
                          <TableCell className="text-sm max-w-[220px] truncate" title={k.alamat ?? ""}>{dash(k.alamat)}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate" title={k.email ?? ""}>{dash(k.email)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{dash(k.noHp)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold whitespace-nowrap">
                            {k.saldo === null ? <span className="font-normal text-slate-300">—</span> : `Rp ${formatRupiah(k.saldo)}`}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            {filtered.length} dari {data.length} kontak
            {tab === "PELANGGAN" || tab === "SEMUA" ? " · Saldo pelanggan = sisa piutang terbuka" : ""}
            {tab === "SUPPLIER" || tab === "SEMUA" ? " · Saldo supplier = sisa utang terbuka" : ""}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setMessage(""); }}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Buat Kontak</DialogTitle>
            <DialogDescription>Master data bersama untuk Penjualan, Pembelian, dan Biaya.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveKontak} className="grid gap-4">
            <KontakFormFields form={form} setForm={setForm} />
            {message && <p className="text-sm text-red-600">{message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KontakEmpty({ hasData }: { hasData: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <ContactRound className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-500">
        {hasData ? "Tidak ada kontak yang cocok dengan filter" : "Belum ada kontak."}
      </p>
      {!hasData && <p className="mt-1 text-xs text-slate-400">Klik “Buat Kontak” untuk menambah pelanggan, supplier, atau karyawan.</p>}
    </div>
  );
}
