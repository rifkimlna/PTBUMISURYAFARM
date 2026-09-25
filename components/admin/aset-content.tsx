"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, X, Pencil, Trash2, Check, PackageSearch, TrendingDown, Undo2 } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { KATEGORI_ASET } from "@/lib/aset";
import { METODE_SUSUT_LABEL, SUMBER_DANA_BY_KODE_AKUN } from "@/lib/aset";

// ================= Tipe =================
export type AsetRow = {
  id: string;
  namaAset: string;
  jumlah: number;
  kategori: string;
  kondisi: string;
  status: string;
  nilaiAset: number;
  tanggalPerolehan: string | null;
  statusAset: string;
  deskripsi: string | null;
  tanggalAkuisisi: string | null;
  biayaAkuisisi: number | null;
  biayaTampil: number;
  akunAset: string | null;
  akunAsetNama: string | null;
  akunKredit: string | null;
  akunKreditNama: string | null;
  tags: string | null;
  noTransaksiAset: string | null;
  transaksiKasId: string | null;
  tagihanId: string | null;
  metodeSusut: string | null;
  masaManfaatBulan: number | null;
  nilaiResidu: number | null;
  akunBebanSusut: string | null;
  akunBebanSusutNama: string | null;
  akunAkumulasi: string | null;
  tanggalMulaiSusut: string | null;
  susutBulanIni: number;
  akumulasiSusut: number;
  nilaiBuku: number;
  tanggalLepas: string | null;
  hargaJual: number | null;
  noTransaksiLepas: string | null;
  caraLepas: string | null;
  keteranganLepas: string | null;
  untungRugi: number | null;
  createdAt: string;
};

type AkunOpt = { kode: string; nama: string; kelompok?: string };

type TabKey = "TERTUNDA" | "AKTIF" | "LEPAS" | "SUSUT";

// ================= Helper =================
function dash(value: string | null | undefined) {
  return value && value.trim() !== "" ? value : "—";
}

function rp(value: number | null | undefined) {
  return value == null ? "—" : `Rp ${formatRupiah(value)}`;
}

function formatTanggal(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function toDateInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function todayInput() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className || ""}`}>
      <span className="text-xs font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function fieldError(result: { errors?: Array<{ message: string }> }, fallback: string) {
  const detail = Array.isArray(result.errors) ? result.errors.map((e) => e.message).join("; ") : null;
  return detail || (result as { message?: string }).message || fallback;
}

function metodeLabel(m: string | null) {
  if (!m) return "—";
  return METODE_SUSUT_LABEL[m] ?? m.replaceAll("_", " ");
}

function akunLabel(kode: string | null, nama: string | null) {
  if (!kode) return "—";
  return nama ? `${kode} - ${nama}` : kode;
}

// ================= Form tambah =================
type AsetForm = {
  id: string;
  nama: string;
  kategori: string;
  kondisi: string;
  akunAset: string;
  deskripsi: string;
  tanggalAkuisisi: string;
  biaya: string;
  akunKredit: string;
  kreditur: string;
  jatuhTempo: string;
  tags: string;
  langsungAktif: boolean;
  nonDep: boolean;
  metode: "" | "GARIS_LURUS" | "SALDO_MENURUN";
  masa: string;
  residu: string;
  akunBeban: string;
  akunAkumulasi: string;
  tanggalMulai: string;
};

const emptyAsetForm = (akunBebanDefault: string): AsetForm => ({
  id: "",
  nama: "",
  kategori: KATEGORI_ASET[0],
  kondisi: "Baik",
  akunAset: "",
  deskripsi: "",
  tanggalAkuisisi: todayInput(),
  biaya: "",
  akunKredit: "",
  kreditur: "",
  jatuhTempo: "",
  tags: "",
  langsungAktif: false,
  nonDep: false,
  metode: "",
  masa: "",
  residu: "",
  akunBeban: akunBebanDefault,
  akunAkumulasi: "",
  tanggalMulai: "",
});

// ================= Komponen =================
export function AsetContent({
  canDelete,
  periode,
  data,
  akunAsetTetap,
  akunKredit,
  akunBeban,
}: {
  canDelete: boolean;
  periode: string;
  data: AsetRow[];
  akunAsetTetap: AkunOpt[];
  akunKredit: AkunOpt[];
  akunBeban: AkunOpt[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("AKTIF");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AsetForm>(() => emptyAsetForm("5408"));
  const [editSusut, setEditSusut] = useState({ metode: "", masa: "", residu: "", akunBeban: "", akunAkumulasi: "", tanggalMulai: "", deskripsi: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmHapusId, setConfirmHapusId] = useState<string | null>(null);

  const [lepasOpen, setLepasOpen] = useState(false);
  const [lepasId, setLepasId] = useState<string | null>(null);
  const [lepasCara, setLepasCara] = useState<"DIJUAL" | "DILEPAS">("DIJUAL");
  const [lepasTanggal, setLepasTanggal] = useState(todayInput());
  const [lepasHarga, setLepasHarga] = useState("");
  const [lepasNo, setLepasNo] = useState("");
  const [lepasKet, setLepasKet] = useState("");
  const [lepasSaving, setLepasSaving] = useState(false);
  const [lepasMsg, setLepasMsg] = useState("");

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { TERTUNDA: 0, AKTIF: 0, LEPAS: 0, SUSUT: 0 };
    for (const r of data) {
      if (r.statusAset === "TERTUNDA") c.TERTUNDA += 1;
      else if (r.statusAset === "AKTIF") {
        c.AKTIF += 1;
        if (r.metodeSusut && r.metodeSusut !== "NON_DEP") c.SUSUT += 1;
      } else if (r.statusAset === "DIJUAL" || r.statusAset === "DILEPAS") c.LEPAS += 1;
      else c.AKTIF += 1;
    }
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (tab === "TERTUNDA" && r.statusAset !== "TERTUNDA") return false;
      if (tab === "AKTIF" && !(r.statusAset === "AKTIF" || !["TERTUNDA", "DIJUAL", "DILEPAS"].includes(r.statusAset))) return false;
      if (tab === "LEPAS" && !(r.statusAset === "DIJUAL" || r.statusAset === "DILEPAS")) return false;
      if (tab === "SUSUT") {
        if (r.statusAset !== "AKTIF" && ["TERTUNDA", "DIJUAL", "DILEPAS"].includes(r.statusAset)) return false;
        if (!r.metodeSusut || r.metodeSusut === "NON_DEP") return false;
      }
      if (q) {
        const hay = `${r.namaAset} ${r.id} ${r.kategori} ${r.akunAset ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, tab, search]);

  const totalSusutBulan = filtered.reduce((s, r) => s + (tab === "SUSUT" ? r.susutBulanIni : 0), 0);

  // ---------- Tambah / edit ----------
  const openTambah = () => {
    setEditingId(null);
    setForm(emptyAsetForm(akunBeban.find((a) => a.kode === "5408") ? "5408" : (akunBeban[0]?.kode ?? "")));
    setMessage("");
    setConfirmHapusId(null);
    setDialogOpen(true);
  };

  const openEdit = (r: AsetRow) => {
    setEditingId(r.id);
    setEditSusut({
      metode: r.metodeSusut ?? "",
      masa: r.masaManfaatBulan == null ? "" : String(r.masaManfaatBulan),
      residu: r.nilaiResidu == null ? "" : String(r.nilaiResidu),
      akunBeban: r.akunBebanSusut ?? "",
      akunAkumulasi: r.akunAkumulasi ?? "",
      tanggalMulai: toDateInput(r.tanggalMulaiSusut),
      deskripsi: r.deskripsi ?? "",
      tags: r.tags ?? "",
    });
    setMessage("");
    setConfirmHapusId(null);
    setDialogOpen(true);
  };

  const kreditTerpilih = akunKredit.find((a) => a.kode === form.akunKredit) ?? null;
  const isKreditDipilih = Boolean(kreditTerpilih && !(kreditTerpilih.kode in SUMBER_DANA_BY_KODE_AKUN));
  const asetTerpilih = akunAsetTetap.find((a) => a.kode === form.akunAset) ?? null;

  const saveAset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (editingId) {
        const res = await fetch(`/api/aset/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deskripsi: editSusut.deskripsi.trim() || null,
            tags: editSusut.tags.trim() || null,
            metodeSusut: editSusut.metode === "" ? null : editSusut.metode,
            masaManfaatBulan: editSusut.masa === "" ? null : Number(editSusut.masa),
            nilaiResidu: editSusut.residu === "" ? null : Number(editSusut.residu),
            akunBebanSusut: editSusut.akunBeban === "" ? null : editSusut.akunBeban,
            akunAkumulasi: editSusut.akunAkumulasi.trim() || null,
            tanggalMulaiSusut: editSusut.tanggalMulai === "" ? null : editSusut.tanggalMulai,
          }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(fieldError(result, "Gagal menyimpan perubahan"));
        setDialogOpen(false);
        router.refresh();
        return;
      }
      const res = await fetch("/api/aset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id.trim().toUpperCase(),
          namaAset: form.nama.trim(),
          kategori: form.kategori,
          kondisi: form.kondisi,
          tanggalAkuisisi: form.tanggalAkuisisi,
          biayaAkuisisi: Number(form.biaya),
          akunAset: form.akunAset,
          akunKredit: form.akunKredit,
          tags: form.tags.trim() || null,
          deskripsi: form.deskripsi.trim() || null,
          kreditur: form.kreditur.trim() || null,
          jatuhTempo: form.jatuhTempo || null,
          langsungAktif: form.langsungAktif,
          nonDepresiasi: form.nonDep,
          metodeSusut: form.nonDep ? null : form.metode || null,
          masaManfaatBulan: form.nonDep || form.masa.trim() === "" ? null : Number(form.masa),
          nilaiResidu: form.residu.trim() === "" ? null : Number(form.residu),
          akunBebanSusut: form.akunBeban || null,
          akunAkumulasi: form.akunAkumulasi.trim() || null,
          tanggalMulaiSusut: form.tanggalMulai || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(fieldError(result, "Gagal menambah aset"));
      setDialogOpen(false);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan aset");
    } finally {
      setSaving(false);
    }
  };

  const hapusAset = async (id: string) => {
    if (confirmHapusId !== id) {
      setConfirmHapusId(id);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/aset/${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus aset");
      setConfirmHapusId(null);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal menghapus aset");
    } finally {
      setSaving(false);
    }
  };

  const aktifkan = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/aset/${encodeURIComponent(id)}/aktifkan`, { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Gagal mengaktifkan aset");
      setTab("AKTIF");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal mengaktifkan aset");
    } finally {
      setSaving(false);
    }
  };

  const batalLepas = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/aset/${encodeURIComponent(id)}/lepas`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Gagal membatalkan");
      setTab("AKTIF");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal membatalkan");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Lepas ----------
  const openLepas = (r: AsetRow) => {
    setLepasId(r.id);
    setLepasCara("DIJUAL");
    setLepasTanggal(todayInput());
    setLepasHarga("");
    setLepasNo("");
    setLepasKet("");
    setLepasMsg("");
    setLepasOpen(true);
  };

  const lepasRow = data.find((r) => r.id === lepasId) ?? null;

  const saveLepas = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lepasId) return;
    setLepasSaving(true);
    setLepasMsg("");
    try {
      const res = await fetch(`/api/aset/${encodeURIComponent(lepasId)}/lepas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cara: lepasCara,
          tanggal: lepasTanggal || null,
          hargaJual: lepasCara === "DIJUAL" ? Number(lepasHarga) : null,
          noTransaksi: lepasNo.trim() || null,
          keterangan: lepasKet.trim() || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(fieldError(result, "Gagal mencatat pelepasan"));
      setLepasOpen(false);
      setTab("LEPAS");
      router.refresh();
    } catch (err) {
      setLepasMsg(err instanceof Error ? err.message : "Gagal mencatat pelepasan");
    } finally {
      setLepasSaving(false);
    }
  };

  const tabBtn = (active: boolean) =>
    `rounded-full px-4 py-1.5 transition-colors cursor-pointer ${active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Aset</h1>
          <p className="mt-1 text-sm text-slate-400">Aset tetap PT Bumi Surya Farm: akuisisi, penyusutan, dan pelepasan.</p>
          {message && <p className="mt-1 text-xs text-red-600">{message}</p>}
        </div>
        <Button type="button" onClick={openTambah} className="w-fit cursor-pointer">
          <Plus className="h-4 w-4" /> Tambah Aset
        </Button>
      </div>

      <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-medium">
        <button type="button" onClick={() => setTab("TERTUNDA")} className={tabBtn(tab === "TERTUNDA")}>Aset Tertunda · {counts.TERTUNDA}</button>
        <button type="button" onClick={() => setTab("AKTIF")} className={tabBtn(tab === "AKTIF")}>Aset Aktif · {counts.AKTIF}</button>
        <button type="button" onClick={() => setTab("LEPAS")} className={tabBtn(tab === "LEPAS")}>Dijual/Dilepas · {counts.LEPAS}</button>
        <button type="button" onClick={() => setTab("SUSUT")} className={tabBtn(tab === "SUSUT")}>Penyusutan · {counts.SUSUT}</button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, nomor, akun" aria-label="Cari aset" className="pl-9 pr-9" />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Bersihkan pencarian" className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {tab === "SUSUT" && (
              <p className="text-xs text-slate-400 sm:ml-auto">Periode {periode} · informatif, belum dijurnal otomatis</p>
            )}
          </div>

          {/* Mobile */}
          <div className="grid gap-3 p-3 md:hidden">
            {filtered.length === 0 ? (
              <AsetEmpty tab={tab} />
            ) : filtered.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-slate-900">{r.id}</div>
                  <div className="text-sm font-medium text-slate-900">{r.namaAset}</div>
                  <div className="text-xs text-slate-500">{r.kategori} • {r.kondisi}</div>
                </div>
                {tab === "TERTUNDA" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Tgl Akuisisi</div><div className="font-medium">{formatTanggal(r.tanggalAkuisisi)}</div></div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Biaya</div><div className="font-semibold">Rp {formatRupiah(r.biayaTampil)}</div></div>
                  </div>
                )}
                {tab === "AKTIF" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Biaya Akuisisi</div><div className="font-medium">Rp {formatRupiah(r.biayaTampil)}</div></div>
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2"><div className="text-[11px] text-emerald-700">Nilai Buku</div><div className="font-semibold text-emerald-900">Rp {formatRupiah(r.nilaiBuku)}</div></div>
                  </div>
                )}
                {tab === "LEPAS" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Harga Jual</div><div className="font-medium">{r.hargaJual == null ? "—" : `Rp ${formatRupiah(r.hargaJual)}`}</div></div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Untung/Rugi</div>
                      <div className={`font-semibold ${r.untungRugi == null ? "" : r.untungRugi >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {r.untungRugi == null ? "—" : `${r.untungRugi >= 0 ? "+" : "−"}Rp ${formatRupiah(Math.abs(r.untungRugi))}`}
                      </div>
                    </div>
                  </div>
                )}
                {tab === "SUSUT" && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Nilai Buku</div><div className="font-medium">Rp {formatRupiah(r.nilaiBuku)}</div></div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Susut {periode}</div><div className="font-semibold">Rp {formatRupiah(r.susutBulanIni)}</div></div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {tab === "TERTUNDA" && <Button variant="outline" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" disabled={saving} onClick={() => aktifkan(r.id)}><Check className="h-3.5 w-3.5" /> Aktifkan</Button>}
                  {tab === "AKTIF" && <Button variant="outline" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" onClick={() => openLepas(r)}><TrendingDown className="h-3.5 w-3.5" /> Jual/Lepas</Button>}
                  {tab === "LEPAS" && <Button variant="outline" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" disabled={saving} onClick={() => batalLepas(r.id)}><Undo2 className="h-3.5 w-3.5" /> Kembalikan</Button>}
                  {(tab === "TERTUNDA" || tab === "AKTIF") && <Button variant="outline" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            {tab === "TERTUNDA" && (
              <div className="min-w-[760px]"><Table>
                <TableHeader><TableRow>
                  <TableHead>Tanggal Akuisisi</TableHead><TableHead>Detail Aset</TableHead>
                  <TableHead className="text-right">Biaya Akuisisi</TableHead><TableHead className="text-right">Aksi</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? <TableRow><TableCell colSpan={4} className="py-8"><AsetEmpty tab={tab} /></TableCell></TableRow>
                    : filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatTanggal(r.tanggalAkuisisi)}</TableCell>
                        <TableCell><DetailAset r={r} /></TableCell>
                        <TableCell className="text-right text-sm font-semibold whitespace-nowrap">Rp {formatRupiah(r.biayaTampil)}</TableCell>
                        <TableCell><AksiTertunda r={r} /></TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table></div>
            )}
            {tab === "AKTIF" && (
              <div className="min-w-[960px]"><Table>
                <TableHeader><TableRow>
                  <TableHead>Tanggal Akuisisi</TableHead><TableHead>Detail Aset</TableHead><TableHead>Akun Aset</TableHead>
                  <TableHead className="text-right">Biaya Akuisisi</TableHead><TableHead className="text-right">Nilai Buku</TableHead><TableHead className="text-right">Aksi</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8"><AsetEmpty tab={tab} /></TableCell></TableRow>
                    : filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatTanggal(r.tanggalAkuisisi)}</TableCell>
                        <TableCell><DetailAset r={r} /></TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">{akunLabel(r.akunAset, r.akunAsetNama)}</TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">Rp {formatRupiah(r.biayaTampil)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold whitespace-nowrap">Rp {formatRupiah(r.nilaiBuku)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-8 cursor-pointer text-xs" onClick={() => openLepas(r)}>Jual/Lepas</Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full cursor-pointer" title="Edit" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <HapusButton id={r.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table></div>
            )}
            {tab === "LEPAS" && (
              <div className="min-w-[860px]"><Table>
                <TableHeader><TableRow>
                  <TableHead>Tanggal</TableHead><TableHead>Detail Aset</TableHead><TableHead>No. Transaksi</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead><TableHead className="text-right">Untung/Rugi</TableHead><TableHead className="text-right">Aksi</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8"><AsetEmpty tab={tab} /></TableCell></TableRow>
                    : filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatTanggal(r.tanggalLepas)}</TableCell>
                        <TableCell><DetailAset r={r} /> <Badge variant="secondary" className="ml-1 text-[10px]">{r.caraLepas === "DIJUAL" ? "Dijual" : "Dilepas"}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{dash(r.noTransaksiLepas)}</TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">{r.hargaJual == null ? "—" : `Rp ${formatRupiah(r.hargaJual)}`}</TableCell>
                        <TableCell className={`text-right text-sm font-semibold whitespace-nowrap ${r.untungRugi == null ? "" : r.untungRugi >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {r.untungRugi == null ? "—" : `${r.untungRugi >= 0 ? "+" : "−"}Rp ${formatRupiah(Math.abs(r.untungRugi))}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-8 cursor-pointer text-xs" disabled={saving} onClick={() => batalLepas(r.id)}><Undo2 className="h-3.5 w-3.5" /> Kembalikan</Button>
                            <HapusButton id={r.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table></div>
            )}
            {tab === "SUSUT" && (
              <div className="min-w-[820px]"><Table>
                <TableHeader><TableRow>
                  <TableHead>Detail Aset</TableHead><TableHead>Periode</TableHead>
                  <TableHead className="text-right">Nilai</TableHead><TableHead>Metode</TableHead><TableHead className="text-right">Penyusutan</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8"><AsetEmpty tab={tab} /></TableCell></TableRow>
                    : filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell><DetailAset r={r} /></TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{periode}</TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">Rp {formatRupiah(r.nilaiBuku)}</TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">{metodeLabel(r.metodeSusut)} · {r.masaManfaatBulan ?? "—"} bln</TableCell>
                        <TableCell className="text-right text-sm font-semibold whitespace-nowrap">Rp {formatRupiah(r.susutBulanIni)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table></div>
            )}
          </div>
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            {filtered.length} aset
            {tab === "SUSUT" && ` · Total penyusutan ${periode}: Rp ${formatRupiah(totalSusutBulan)} (beban 5408, belum dijurnal)`}
            {tab === "AKTIF" && ` · Nilai buku = biaya akuisisi − akumulasi penyusutan`}
          </div>
        </CardContent>
      </Card>

      {/* Dialog tambah / edit */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setMessage(""); }}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Aset" : "Tambah Aset"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Ubah data master dan parameter penyusutan." : "Penyimpanan aset baru: master + satu jurnal akuisisi (tanpa ganda)."}
            </DialogDescription>
          </DialogHeader>
          {!editingId ? (
            <form onSubmit={saveAset} className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama aset" required className="sm:col-span-2">
                  <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Mesin perontok padi" maxLength={100} required />
                </Field>
                <Field label="Nomor aset" required>
                  <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.toUpperCase() })} placeholder="AST-006" maxLength={20} required />
                </Field>
                <Field label="Akun aset tetap" required>
                  <Select value={form.akunAset} onChange={(e) => setForm({ ...form, akunAset: e.target.value })} required>
                    <option value="">Pilih akun</option>
                    {akunAsetTetap.map((a) => (<option key={a.kode} value={a.kode}>{a.kode} - {a.nama}</option>))}
                  </Select>
                </Field>
                <Field label="Deskripsi" className="sm:col-span-2">
                  <Textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Spesifikasi / nomor seri (opsional)" />
                </Field>
                <Field label="Tanggal akuisisi" required>
                  <Input type="date" value={form.tanggalAkuisisi} onChange={(e) => setForm({ ...form, tanggalAkuisisi: e.target.value })} required />
                </Field>
                <Field label="Biaya akuisisi (Rp)" required>
                  <Input type="number" min="1000" step="any" value={form.biaya} onChange={(e) => setForm({ ...form, biaya: e.target.value })} placeholder="20000000" required />
                </Field>
                <Field label="Akun yang dikreditkan" required>
                  <Select value={form.akunKredit} onChange={(e) => setForm({ ...form, akunKredit: e.target.value })} required>
                    <option value="">Pilih akun</option>
                    {akunKredit.map((a) => (<option key={a.kode} value={a.kode}>{a.kode} - {a.nama}</option>))}
                  </Select>
                </Field>
                <Field label="Kategori">
                  <Select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
                    {KATEGORI_ASET.map((k) => (<option key={k} value={k}>{k}</option>))}
                  </Select>
                </Field>
                {isKreditDipilih && (
                  <>
                    <Field label="Kreditur" required>
                      <Input value={form.kreditur} onChange={(e) => setForm({ ...form, kreditur: e.target.value })} placeholder="Nama pemasok" maxLength={100} required={isKreditDipilih} />
                    </Field>
                    <Field label="Jatuh tempo">
                      <Input type="date" value={form.jatuhTempo} onChange={(e) => setForm({ ...form, jatuhTempo: e.target.value })} />
                    </Field>
                  </>
                )}
                <Field label="Kondisi">
                  <Select value={form.kondisi} onChange={(e) => setForm({ ...form, kondisi: e.target.value })}>
                    <option value="Baik">Baik</option>
                    <option value="Rusak Ringan">Rusak Ringan</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </Select>
                </Field>
                <Field label="Tags">
                  <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Opsional" maxLength={200} />
                </Field>
                <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
                  <input type="checkbox" checked={form.langsungAktif} onChange={(e) => setForm({ ...form, langsungAktif: e.target.checked })} className="h-4 w-4 accent-green-700" />
                  Langsung catat sebagai aset aktif (tanpa centang = Aset Tertunda)
                </label>
                {form.akunAset && form.akunKredit && form.biaya.trim() !== "" && (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:col-span-2">
                    Jurnal: Dr {form.akunAset} ({asetTerpilih?.nama ?? ""}) · Cr {form.akunKredit} ({kreditTerpilih?.nama ?? ""}) · Rp {formatRupiah(Number(form.biaya) || 0)}
                    {isKreditDipilih ? " (utang usaha)" : " (kas/bank)"}
                  </p>
                )}
              </div>
              <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <div className="sm:col-span-2 text-xs font-semibold text-slate-700">Penyusutan</div>
                <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
                  <input type="checkbox" checked={form.nonDep} onChange={(e) => setForm({ ...form, nonDep: e.target.checked })} className="h-4 w-4 accent-green-700" />
                  Aset non-depresiasi (tanah, tanaman produktif tertentu)
                </label>
                {!form.nonDep && (
                  <>
                    <Field label="Metode penyusutan" required>
                      <Select value={form.metode} onChange={(e) => setForm({ ...form, metode: e.target.value as AsetForm["metode"] })} required={!form.nonDep}>
                        <option value="">Pilih metode</option>
                        <option value="GARIS_LURUS">Garis Lurus</option>
                        <option value="SALDO_MENURUN">Saldo Menurun</option>
                      </Select>
                    </Field>
                    <Field label="Masa manfaat (bulan)" required>
                      <Input type="number" min="1" max="1200" step="1" value={form.masa} onChange={(e) => setForm({ ...form, masa: e.target.value })} placeholder="48" required={!form.nonDep} />
                    </Field>
                    <Field label="Nilai residu (Rp)">
                      <Input type="number" min="0" step="any" value={form.residu} onChange={(e) => setForm({ ...form, residu: e.target.value })} placeholder="0" />
                    </Field>
                    <Field label="Tanggal mulai penyusutan">
                      <Input type="date" value={form.tanggalMulai} onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })} placeholder="ikut tanggal akuisisi" />
                    </Field>
                    <Field label="Akun beban penyusutan">
                      <Select value={form.akunBeban} onChange={(e) => setForm({ ...form, akunBeban: e.target.value })}>
                        {akunBeban.map((a) => (<option key={a.kode} value={a.kode}>{a.kode} - {a.nama}</option>))}
                      </Select>
                    </Field>
                    <Field label="Akumulasi penyusutan">
                      <Input value={form.akunAkumulasi} onChange={(e) => setForm({ ...form, akunAkumulasi: e.target.value })} placeholder="Belum ada akun di COA" maxLength={100} />
                    </Field>
                  </>
                )}
              </div>
              {message && <p className="text-sm text-red-600">{message}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Aset"}</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={saveAset} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Deskripsi" className="sm:col-span-2">
                  <Textarea value={editSusut.deskripsi} onChange={(e) => setEditSusut({ ...editSusut, deskripsi: e.target.value })} />
                </Field>
                <Field label="Tags" className="sm:col-span-2">
                  <Input value={editSusut.tags} onChange={(e) => setEditSusut({ ...editSusut, tags: e.target.value })} maxLength={200} />
                </Field>
                <Field label="Metode penyusutan" className="sm:col-span-2">
                  <Select value={editSusut.metode} onChange={(e) => setEditSusut({ ...editSusut, metode: e.target.value })}>
                    <option value="">Tidak diatur</option>
                    <option value="NON_DEP">Non-depresiasi</option>
                    <option value="GARIS_LURUS">Garis Lurus</option>
                    <option value="SALDO_MENURUN">Saldo Menurun</option>
                  </Select>
                </Field>
                <Field label="Masa manfaat (bulan)">
                  <Input type="number" min="1" max="1200" value={editSusut.masa} onChange={(e) => setEditSusut({ ...editSusut, masa: e.target.value })} />
                </Field>
                <Field label="Nilai residu (Rp)">
                  <Input type="number" min="0" step="any" value={editSusut.residu} onChange={(e) => setEditSusut({ ...editSusut, residu: e.target.value })} />
                </Field>
                <Field label="Akun beban penyusutan">
                  <Select value={editSusut.akunBeban} onChange={(e) => setEditSusut({ ...editSusut, akunBeban: e.target.value })}>
                    <option value="">Tidak diatur</option>
                    {akunBeban.map((a) => (<option key={a.kode} value={a.kode}>{a.kode} - {a.nama}</option>))}
                  </Select>
                </Field>
                <Field label="Tanggal mulai penyusutan">
                  <Input type="date" value={editSusut.tanggalMulai} onChange={(e) => setEditSusut({ ...editSusut, tanggalMulai: e.target.value })} />
                </Field>
                <Field label="Akumulasi penyusutan" className="sm:col-span-2">
                  <Input value={editSusut.akunAkumulasi} onChange={(e) => setEditSusut({ ...editSusut, akunAkumulasi: e.target.value })} placeholder="Belum ada akun di COA" maxLength={100} />
                </Field>
              </div>
              <p className="text-[11px] text-slate-400">Biaya, akun, dan tanggal akuisisi dikunci setelah jurnal tercatat.</p>
              {message && <p className="text-sm text-red-600">{message}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Perubahan"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog jual / lepas */}
      <Dialog open={lepasOpen} onOpenChange={(v) => { setLepasOpen(v); if (!v) setLepasMsg(""); }}>
        <DialogContent onClose={() => setLepasOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Jual / Lepas Aset</DialogTitle>
            <DialogDescription>{lepasRow ? `${lepasRow.namaAset} (${lepasRow.id}) · Nilai buku Rp ${formatRupiah(lepasRow.nilaiBuku)}` : ""} — pencatatan saja, tanpa Kas otomatis.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveLepas} className="grid gap-4">
            <Field label="Cara" required>
              <Select value={lepasCara} onChange={(e) => setLepasCara(e.target.value as "DIJUAL" | "DILEPAS")}>
                <option value="DIJUAL">Dijual</option>
                <option value="DILEPAS">Dilepas (hibah/hilang/rusak total)</option>
              </Select>
            </Field>
            <Field label="Tanggal" required>
              <Input type="date" value={lepasTanggal} onChange={(e) => setLepasTanggal(e.target.value)} required />
            </Field>
            {lepasCara === "DIJUAL" && (
              <Field label="Harga jual (Rp)" required>
                <Input type="number" min="1" step="any" value={lepasHarga} onChange={(e) => setLepasHarga(e.target.value)} required />
              </Field>
            )}
            <Field label="No. transaksi">
              <Input value={lepasNo} onChange={(e) => setLepasNo(e.target.value)} placeholder="Opsional" maxLength={50} />
            </Field>
            <Field label="Keterangan">
              <Input value={lepasKet} onChange={(e) => setLepasKet(e.target.value)} placeholder="Opsional" maxLength={1000} />
            </Field>
            {lepasMsg && <p className="text-sm text-red-600">{lepasMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLepasOpen(false)}>Batal</Button>
              <Button type="submit" disabled={lepasSaving}>{lepasSaving ? "Menyimpan..." : "Catat Pelepasan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );

  function DetailAset({ r }: { r: AsetRow }) {
    return (
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900">{r.namaAset}</div>
        <div className="font-mono text-[11px] text-slate-400">{r.id}{r.jumlah > 1 ? ` · ×${r.jumlah}` : ""}</div>
        <div className="text-[11px] text-slate-500 truncate max-w-[240px]">{r.kategori} • {r.kondisi}</div>
      </div>
    );
  }

  function AksiTertunda({ r }: { r: AsetRow }) {
    return (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" className="h-8 cursor-pointer text-xs" disabled={saving} onClick={() => aktifkan(r.id)}>
          <Check className="h-3.5 w-3.5" /> Aktifkan
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full cursor-pointer" title="Edit" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
        <HapusButton id={r.id} />
      </div>
    );
  }

  function HapusButton({ id }: { id: string }) {
    if (!canDelete) return null;
    if (confirmHapusId === id) {
      return (
        <span className="flex items-center gap-1">
          <Button variant="destructive" size="sm" className="h-7 cursor-pointer" disabled={saving} onClick={() => hapusAset(id)}><Check className="h-3.5 w-3.5" /> Ya</Button>
          <Button variant="ghost" size="sm" className="h-7 cursor-pointer" onClick={() => setConfirmHapusId(null)}>Batal</Button>
        </span>
      );
    }
    return (
      <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 cursor-pointer" title="Hapus" onClick={() => hapusAset(id)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    );
  }
}

function AsetEmpty({ tab }: { tab: string }) {
  const text =
    tab === "TERTUNDA" ? "Belum ada aset tertunda."
    : tab === "AKTIF" ? "Belum ada aset aktif."
    : tab === "LEPAS" ? "Belum ada aset yang dijual/dilepas."
    : "Belum ada jadwal penyusutan.";
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <PackageSearch className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-500">{text}</p>
      {tab === "SUSUT" && <p className="mt-1 text-xs text-slate-400">Aktifkan aset yang dapat disusutkan untuk melihat jadwalnya.</p>}
    </div>
  );
}
