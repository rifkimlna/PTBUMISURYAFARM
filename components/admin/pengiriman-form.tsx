"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Paperclip, X } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

export type PengirimanPesanan = {
  id: string;
  noDokumen: string;
  pelangganNama: string;
  pelangganEmail: string | null;
  alamat: string | null;
  noRefPelanggan: string | null;
  pesan: string | null;
  memo: string | null;
  items: Array<{
    deskripsi: string;
    kuantitas: number;
    unit: string;
    harga: number;
    jumlah: number;
  }>;
};

type LampiranBaru = { fileName: string; fileUrl: string; fileType: string; fileSize: number };

function todayInput() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Form Pengiriman Penjualan mengikuti struktur Mekari (disesuaikan PT BST).
// Pelanggan & produk diambil dari Pesanan asal (read-only); yang diisi:
// alamat, tgl pengiriman, kirim melalui, no pelacakan, gudang, pesan, memo, lampiran.
// Menyimpan TIDAK membuat transaksi keuangan/pemasukan.
export function PengirimanForm({ pesanan }: { pesanan: PengirimanPesanan }) {
  const router = useRouter();
  const [alamat, setAlamat] = useState(pesanan.alamat ?? "");
  const [tanggal, setTanggal] = useState(todayInput());
  const [noRef, setNoRef] = useState(pesanan.noRefPelanggan ?? "");
  const [kirimMelalui, setKirimMelalui] = useState("");
  const [noPelacakan, setNoPelacakan] = useState("");
  const [gudang, setGudang] = useState("");
  const [pesan, setPesan] = useState(pesanan.pesan ?? "");
  const [memo, setMemo] = useState(pesanan.memo ?? "");
  const [lampiran, setLampiran] = useState<Array<LampiranBaru & { key: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || uploading) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    try {
      const res = await fetch("/api/penjualan/lampiran", { method: "POST", body: formData });
      const result = await res.json().catch(() => ({}));
      if (result.success) {
        const uploaded = (result.data?.items ?? []) as LampiranBaru[];
        if (uploaded.length > 0) {
          setLampiran((cur) => [...cur, ...uploaded.map((l) => ({ ...l, key: `new-${Date.now()}-${Math.random()}` }))]);
        } else {
          setError("Tidak ada file yang berhasil ditambahkan");
        }
      } else {
        setError(result.message || "Gagal upload lampiran");
      }
    } catch {
      setError("Gagal upload lampiran");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/penjualan/pengiriman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pesananId: pesanan.id,
          alamatPengiriman: alamat.trim() || undefined,
          tanggalPengiriman: tanggal || undefined,
          noRefPelanggan: noRef.trim() || undefined,
          kirimMelalui: kirimMelalui.trim() || undefined,
          noPelacakan: noPelacakan.trim() || undefined,
          gudang: gudang.trim() || undefined,
          pesan: pesan.trim() || undefined,
          memo: memo.trim() || undefined,
          ...(lampiran.length > 0
            ? { lampiran: lampiran.map(({ fileName, fileUrl, fileType, fileSize }) => ({ fileName, fileUrl, fileType, fileSize })) }
            : {}),
        }),
      });
      const result = await res.json().catch(() => ({ message: "Gagal menyimpan pengiriman" }));
      if (!res.ok) throw new Error(result.message || "Gagal menyimpan pengiriman");
      router.push("/keuangan/penjualan?tab=pengiriman");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengiriman");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Pengiriman Penjualan</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Dari Pesanan {pesanan.noDokumen} · {pesanan.pelangganNama}. Tanpa transaksi keuangan.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
              No. Pengiriman: otomatis (PENG-...)
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Pelanggan</span>
              <Input value={pesanan.pelangganNama} disabled />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Nomor Pesanan Penjualan</span>
              <Input value={pesanan.noDokumen} disabled />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Alamat Pengiriman</span>
              <Textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Alamat pengiriman barang" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Tgl. Pengiriman</span>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">No. Referensi Pelanggan</span>
              <Input value={noRef} onChange={(e) => setNoRef(e.target.value)} placeholder="No. PO / referensi" maxLength={50} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Kirim Melalui</span>
              <Input value={kirimMelalui} onChange={(e) => setKirimMelalui(e.target.value)} placeholder="Ekspedisi / armada sendiri" maxLength={100} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">No. Pelacakan</span>
              <Input value={noPelacakan} onChange={(e) => setNoPelacakan(e.target.value)} placeholder="Resi / no. pelacakan" maxLength={100} />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Gudang</span>
              <Input value={gudang} onChange={(e) => setGudang(e.target.value)} placeholder="Gudang asal barang" maxLength={100} />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-500">
              Produk dari Pesanan (otomatis, tidak input ulang)
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk / Deskripsi</TableHead>
                    <TableHead className="text-right">Kuantitas</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pesanan.items.map((it, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{it.deskripsi}</TableCell>
                      <TableCell className="text-right text-sm">{it.kuantitas.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-sm text-slate-500">{it.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Pesan</span>
              <Textarea value={pesan} onChange={(e) => setPesan(e.target.value)} placeholder="Pesan untuk pelanggan (opsional)" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Memo</span>
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Catatan internal (opsional)" />
            </label>
            <div className="sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Lampiran</span>
              <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              {lampiran.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {lampiran.map((item) => (
                    <li key={item.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{item.fileName}</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 shrink-0 rounded-full p-0 text-slate-400 hover:text-red-600" onClick={() => setLampiran((cur) => cur.filter((l) => l.key !== item.key))} title="Hapus dari daftar">
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" variant="outline" size="sm" className="mt-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                {uploading ? "Mengupload..." : "+ Tambah Lampiran"}
              </Button>
            </div>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Nilai barang Rp {formatRupiah(pesanan.items.reduce((s, it) => s + it.jumlah, 0))} hanya informasi — tidak
            dicatat sebagai pemasukan. Pemasukan hanya tercatat saat Penagihan dibayar.
          </p>
        </CardContent>
      </Card>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(`/keuangan/penjualan/pesanan/${pesanan.id}`)} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Pengiriman"}
        </Button>
      </div>
    </form>
  );
}
