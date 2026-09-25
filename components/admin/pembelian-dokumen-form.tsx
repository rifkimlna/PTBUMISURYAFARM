"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Paperclip, X } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { jatuhTempoDari } from "@/lib/tempo";
import {
  SupplierField,
  ItemsTable,
  LampiranUploader,
  SYARAT_OPTIONS,
  hitungBaris,
  todayInput,
  type ItemBaris,
  type LampiranItem,
  type Lampiran,
} from "@/components/admin/pembelian-forms";

export type TipeDokBeli = "PERMINTAAN" | "PENAWARAN" | "PESANAN";

const META: Record<TipeDokBeli, { judul: string; sub: string; tempo: string; tab: string; noPrefix: string }> = {
  PERMINTAAN: { judul: "Permintaan Pembelian", sub: "Permintaan barang internal", tempo: "Tanggal Dibutuhkan", tab: "permintaan", noPrefix: "PR-..." },
  PENAWARAN: { judul: "Penawaran Pembelian", sub: "Penawaran harga dari supplier", tempo: "Tanggal Kedaluwarsa", tab: "penawaran", noPrefix: "QTN-B-..." },
  PESANAN: { judul: "Pemesanan Pembelian", sub: "Purchase order ke supplier", tempo: "Target / Jatuh Tempo", tab: "pesanan", noPrefix: "PO-..." },
};

export type DokBeliHeader = {
  supplierId: string;
  departemen: string;
  email: string;
  alamat: string;
  tanggal: string;
  jatuhTempo: string;
  noRef: string;
  syarat: string;
  gudang: string;
  pesan: string;
  memo: string;
};

export type DokBeliInitial = {
  id: string;
  header: DokBeliHeader;
  items: ItemBaris[];
  lampiran: LampiranItem[];
  referensiIds: string[];
  supplierNama?: string;
};

const emptyHeader = (): DokBeliHeader => ({
  supplierId: "",
  departemen: "",
  email: "",
  alamat: "",
  tanggal: todayInput(),
  jatuhTempo: "",
  noRef: "",
  syarat: "",
  gudang: "",
  pesan: "",
  memo: "",
});

const emptyItems = (): ItemBaris[] => [
  { key: Date.now() + Math.random(), produkId: "", deskripsi: "", kuantitas: "1", unit: "", harga: "", diskon: "0" },
];

// Form dokumen pembelian tahap awal (tanpa jurnal keuangan).
// Mendukung buat baru (dengan prefill + referensiIds) dan ubah.
export function DokumenBeliForm({ tipe, initial }: { tipe: TipeDokBeli; initial?: DokBeliInitial | null }) {
  const router = useRouter();
  const meta = META[tipe];
  const isEdit = Boolean(initial?.id);
  const [header, setHeader] = useState<DokBeliHeader>(initial?.header ?? emptyHeader());
  const [items, setItems] = useState<ItemBaris[]>(initial?.items ?? emptyItems());
  const [lampiran, setLampiran] = useState<LampiranItem[]>(initial?.lampiran ?? []);
  const [hapusLampiranIds, setHapusLampiranIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof DokBeliHeader>(k: K, v: DokBeliHeader[K]) => setHeader((h) => ({ ...h, [k]: v }));

  const tambahLampiran = (baru: Lampiran[]) =>
    setLampiran((cur) => [...cur, ...baru.map((l) => ({ ...l, key: `new-${Date.now()}-${Math.random()}` }))]);
  const hapusLampiran = (key: string) =>
    setLampiran((cur) => {
      const target = cur.find((l) => l.key === key);
      if (target?.id) setHapusLampiranIds((ids) => [...ids, target.id as string]);
      return cur.filter((l) => l.key !== key);
    });

  const total = items.reduce((s, it) => s + hitungBaris(it), 0);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (tipe !== "PERMINTAAN" && !header.supplierId) throw new Error("Supplier wajib dipilih");
      const payload = {
        ...(isEdit ? {} : { tipe, supplierId: header.supplierId || undefined }),
        departemen: header.departemen.trim() || undefined,
        email: header.email.trim() || undefined,
        alamat: header.alamat.trim() || undefined,
        tanggal: header.tanggal || undefined,
        jatuhTempo: header.jatuhTempo || undefined,
        noRefSupplier: header.noRef.trim() || undefined,
        syaratPembayaran: header.syarat.trim() || undefined,
        gudang: header.gudang.trim() || undefined,
        pesan: header.pesan.trim() || undefined,
        memo: header.memo.trim() || undefined,
        items: items.map((it) => ({
          produkId: it.produkId || undefined,
          deskripsi: it.deskripsi.trim(),
          kuantitas: Number(it.kuantitas),
          unit: it.unit.trim(),
          harga: Number(it.harga),
          diskonPersen: Number(it.diskon) || 0,
        })),
        ...(!isEdit && initial?.referensiIds?.length ? { referensiIds: initial.referensiIds } : {}),
        ...(lampiran.filter((l) => !l.id).length > 0
          ? { lampiran: lampiran.filter((l) => !l.id).map(({ fileName, fileUrl, fileType, fileSize }) => ({ fileName, fileUrl, fileType, fileSize })) }
          : {}),
        ...(isEdit ? { hapusLampiranIds } : {}),
      };
      const url = isEdit && initial ? `/api/pembelian/dokumen/${encodeURIComponent(initial.id)}` : "/api/pembelian/dokumen";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({ message: "Gagal menyimpan dokumen" }));
      if (!res.ok) {
        const detail = Array.isArray((result as { errors?: { message: string }[] }).errors)
          ? (result as { errors: { message: string }[] }).errors.map((x) => x.message).join("; ")
          : null;
        throw new Error(detail || result.message || "Gagal menyimpan dokumen");
      }
      router.push(`/keuangan/pembelian?tab=${meta.tab}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan dokumen");
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
              <CardTitle className="text-base">{isEdit ? `Ubah ${meta.judul}` : meta.judul}</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                {meta.sub}. Tanpa utang maupun Kas & Bank.
                {initial?.supplierNama ? ` · ${initial.supplierNama}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
              No. Dokumen: otomatis ({meta.noPrefix})
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {tipe === "PERMINTAAN" ? (
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Departemen</span>
                <Input value={header.departemen} onChange={(e) => set("departemen", e.target.value)} placeholder="Departemen peminta" maxLength={100} />
              </label>
            ) : (
              <div className="sm:col-span-2">
                <SupplierField
                  value={header.supplierId}
                  onSelect={(id, p) => {
                    set("supplierId", id);
                    if (!p) return;
                    set("email", p.email ?? "");
                    set("alamat", p.alamat ?? "");
                  }}
                />
              </div>
            )}
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Email</span>
              <Input type="email" value={header.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" maxLength={100} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Alamat</span>
              <Input value={header.alamat} onChange={(e) => set("alamat", e.target.value)} placeholder="Alamat" maxLength={1000} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Tanggal</span>
              <Input type="date" value={header.tanggal} onChange={(e) => {
                const tgl = e.target.value;
                set("tanggal", tgl);
                if (header.syarat) {
                  const jt = jatuhTempoDari(tgl, header.syarat);
                  if (jt) set("jatuhTempo", jt);
                }
              }} required />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">{meta.tempo}</span>
              <Input type="date" value={header.jatuhTempo} onChange={(e) => set("jatuhTempo", e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Nomor referensi supplier</span>
              <Input value={header.noRef} onChange={(e) => set("noRef", e.target.value)} placeholder="No. referensi" maxLength={50} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Syarat pembayaran</span>
              <Select value={header.syarat} onChange={(e) => {
                const s = e.target.value;
                set("syarat", s);
                const jt = jatuhTempoDari(header.tanggal, s);
                if (jt) set("jatuhTempo", jt);
              }}>
                <option value="">Pilih syarat</option>
                {SYARAT_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Gudang</span>
              <Input value={header.gudang} onChange={(e) => set("gudang", e.target.value)} placeholder="Gudang tujuan" maxLength={100} />
            </label>
          </div>
          <ItemsTable items={items} setItems={setItems} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Pesan</span>
              <Textarea value={header.pesan} onChange={(e) => set("pesan", e.target.value)} placeholder="Pesan (opsional)" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Memo</span>
              <Textarea value={header.memo} onChange={(e) => set("memo", e.target.value)} placeholder="Catatan internal (opsional)" />
            </label>
            <div className="sm:col-span-2">
              <LampiranUploader value={lampiran} onAdd={tambahLampiran} onRemove={hapusLampiran} />
            </div>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Total Rp {formatRupiah(total)} hanya informasi — tidak dicatat sebagai utang. Utang baru terbentuk saat Faktur dibuat.
          </p>
        </CardContent>
      </Card>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(`/keuangan/pembelian?tab=${meta.tab}`)} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Buat"}
        </Button>
      </div>
    </form>
  );
}

// ---------- Tombol Tindakan di halaman detail ----------

export function DokumenBeliActions({ id, tipe, status }: { id: string; tipe: TipeDokBeli; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const selesai = status === "SELESAI";
  const itemCls =
    "flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/pembelian/dokumen/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selesai ? "BELUM_DITAGIH" : "SELESAI" }),
      });
      const result = await res.json().catch(() => ({ message: "Gagal ubah status" }));
      if (!res.ok) throw new Error(result.message || "Gagal ubah status");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal ubah status");
    } finally {
      setBusy(false);
    }
  };

  const hapus = async () => {
    if (!window.confirm("Hapus dokumen ini?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/pembelian/dokumen/${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({ message: "Gagal menghapus" }));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus");
      router.push(`/keuangan/pembelian?tab=${tipe === "PESANAN" ? "pesanan" : tipe === "PENAWARAN" ? "penawaran" : "permintaan"}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} disabled={busy}>
        Tindakan
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {tipe === "PERMINTAAN" && (
            <Link href={`/keuangan/pembelian/penawaran/baru?dari=${id}`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
              <span><span className="block font-medium text-slate-900">Buat Penawaran</span><span className="block text-xs text-slate-500">Minta harga supplier</span></span>
            </Link>
          )}
          {tipe === "PENAWARAN" && (
            <Link href={`/keuangan/pembelian/pemesanan/baru?dari=${id}`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
              <span><span className="block font-medium text-slate-900">Buat Pesanan</span><span className="block text-xs text-slate-500">Lanjutkan jadi PO</span></span>
            </Link>
          )}
          {tipe === "PESANAN" && (
            <>
              <Link href={`/keuangan/pembelian/pengiriman/baru?pesananId=${id}`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
                <span><span className="block font-medium text-slate-900">Buat Penerimaan</span><span className="block text-xs text-slate-500">Terima barang sesuai PO</span></span>
              </Link>
              <Link href={`/keuangan/pembelian/faktur/baru?dariPesanan=${id}`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
                <span><span className="block font-medium text-slate-900">Buat Faktur</span><span className="block text-xs text-slate-500">Tagih jadi utang</span></span>
              </Link>
            </>
          )}
          <button type="button" role="menuitem" className={itemCls} disabled={busy} onClick={toggle}>
            <span><span className="block font-medium text-slate-900">{selesai ? "Buka kembali" : "Tutup dokumen"}</span><span className="block text-xs text-slate-500">{selesai ? "Status kembali Belum Ditagih" : "Tandai selesai"}</span></span>
          </button>
          <div className="border-t border-slate-100" />
          <button type="button" role="menuitem" className={itemCls} disabled={busy} onClick={hapus}>
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <span><span className="block font-medium text-red-600">Hapus</span></span>
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ---------- Form Penerimaan/Pengiriman Pembelian ----------

export type PengirimanBeliPesanan = {
  id: string;
  noDokumen: string;
  supplierNama: string;
  supplierEmail: string | null;
  alamat: string | null;
  noRefSupplier: string | null;
  gudang: string | null;
  pesan: string | null;
  memo: string | null;
  items: Array<{ deskripsi: string; kuantitas: number; unit: string; harga: number; jumlah: number }>;
};

type LampiranBaru = { fileName: string; fileUrl: string; fileType: string; fileSize: number };

export function PengirimanBeliForm({ pesanan }: { pesanan: PengirimanBeliPesanan }) {
  const router = useRouter();
  const [alamat, setAlamat] = useState(pesanan.alamat ?? "");
  const [tanggal, setTanggal] = useState(todayInput());
  const [noTransaksi, setNoTransaksi] = useState("");
  const [noRef, setNoRef] = useState(pesanan.noRefSupplier ?? "");
  const [gudang, setGudang] = useState(pesanan.gudang ?? "");
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
      const res = await fetch("/api/pembelian/lampiran", { method: "POST", body: formData });
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
      const res = await fetch("/api/pembelian/pengiriman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pesananId: pesanan.id,
          alamatPengiriman: alamat.trim() || undefined,
          tanggalPengiriman: tanggal || undefined,
          noTransaksi: noTransaksi.trim() || undefined,
          noRefSupplier: noRef.trim() || undefined,
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
      router.push("/keuangan/pembelian?tab=pengiriman");
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
              <CardTitle className="text-base">Penerimaan Pembelian</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Dari Pesanan {pesanan.noDokumen} · {pesanan.supplierNama}. Tanpa transaksi keuangan.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
              No. Penerimaan: otomatis (PENG-B-...)
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Supplier</span>
              <Input value={pesanan.supplierNama} disabled />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Email</span>
              <Input value={pesanan.supplierEmail ?? ""} disabled placeholder="—" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Nomor Pesanan Pembelian</span>
              <Input value={pesanan.noDokumen} disabled />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">No. Transaksi</span>
              <Input value={noTransaksi} onChange={(e) => setNoTransaksi(e.target.value)} placeholder="Otomatis bila dikosongkan" maxLength={50} />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Alamat Pengiriman</span>
              <Textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Alamat penerimaan barang" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Tgl. Penerimaan</span>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">No. Referensi Supplier</span>
              <Input value={noRef} onChange={(e) => setNoRef(e.target.value)} placeholder="No. referensi" maxLength={50} />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Gudang</span>
              <Input value={gudang} onChange={(e) => setGudang(e.target.value)} placeholder="Gudang tujuan barang" maxLength={100} />
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
              <Textarea value={pesan} onChange={(e) => setPesan(e.target.value)} placeholder="Pesan untuk supplier (opsional)" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-600">Memo</span>
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Catatan internal (opsional)" />
            </label>
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Lampiran</span>
                <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  {uploading ? "Mengupload..." : "+ Tambah Lampiran"}
                </Button>
              </div>
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
            </div>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Nilai barang Rp {formatRupiah(pesanan.items.reduce((s, it) => s + it.jumlah, 0))} hanya informasi — tidak
            dicatat sebagai utang. Utang baru terbentuk saat Faktur dibuat.
          </p>
        </CardContent>
      </Card>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(`/keuangan/pembelian?tab=pesanan`)} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Buat"}
        </Button>
      </div>
    </form>
  );
}
