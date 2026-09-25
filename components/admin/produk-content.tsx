"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Plus, Search, X, ChevronDown, PackageSearch, Warehouse, Tag,
  FileSpreadsheet, Upload, Pencil, Trash2, Scale, Check,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { kategoriPersediaanList } from "@/lib/validations/persediaanValidation";

// ================= Tipe =================
export type ProdukRow = {
  id: string;
  namaBarang: string;
  kategori: string;
  tipeProduk: string;
  barcode: string | null;
  satuan: string;
  stokAwal: number;
  stok: number | null;
  batasMinimum: number;
  hargaSatuan: number;
  hargaBeli: number | null;
  hargaJual: number | null;
  hargaBeliTerakhir: number | null;
  hargaRataRata: number | null;
  status: "Tersedia" | "Stok Menipis" | "Habis" | "Jasa";
  keterangan: string | null;
  createdAt: string;
};

export type GudangRow = {
  id: string;
  kode: string;
  nama: string;
  alamat: string | null;
  status: string;
  createdAt: string;
};

export type PenyesuaianRow = {
  id: string;
  tanggal: string;
  barangId: string;
  barangNama: string;
  satuan: string;
  jenis: "MASUK" | "KELUAR";
  jumlah: number;
  keterangan: string | null;
};

export type KategoriRow = { kategori: string; jumlahProduk: number };

export type ProdukSummary = {
  tersedia: number;
  segeraHabis: number;
  habis: number;
  totalStok: number;
  gudangAktif: number;
  gudangTotal: number;
};

type TabKey = "BARANG" | "GUDANG" | "HARGA";
type SubKey = "PRODUK" | "SESUAI" | "SETUJU";

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

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const csv = [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Parser CSV sederhana (mendukung koma dalam tanda kutip).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (ch === "\r") { /* abaikan */ }
    else cur += ch;
  }
  if (cur !== "" || row.length > 0) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ================= Form produk =================
type ProdukForm = {
  kode: string;
  nama: string;
  kategori: string;
  tipe: "BARANG" | "JASA";
  barcode: string;
  satuan: string;
  deskripsi: string;
  hargaBeli: string;
  hargaJual: string;
  stokAwal: string;
  batasMinimum: string;
};

const emptyProdukForm = (): ProdukForm => ({
  kode: "",
  nama: "",
  kategori: kategoriPersediaanList[0],
  tipe: "BARANG",
  barcode: "",
  satuan: "",
  deskripsi: "",
  hargaBeli: "",
  hargaJual: "",
  stokAwal: "0",
  batasMinimum: "0",
});

function produkFormFromRow(r: ProdukRow): ProdukForm {
  return {
    kode: r.id,
    nama: r.namaBarang,
    kategori: r.kategori,
    tipe: r.tipeProduk === "JASA" ? "JASA" : "BARANG",
    barcode: r.barcode ?? "",
    satuan: r.satuan,
    deskripsi: r.keterangan ?? "",
    hargaBeli: r.hargaBeli == null ? "" : String(r.hargaBeli),
    hargaJual: r.hargaJual == null ? "" : String(r.hargaJual),
    stokAwal: String(r.stokAwal),
    batasMinimum: String(r.batasMinimum),
  };
}

// ================= Komponen utama =================
export function ProdukContent({
  canDelete,
  summary,
  produk,
  gudang,
  penyesuaian,
  kategori,
}: {
  canDelete: boolean;
  summary: ProdukSummary;
  produk: ProdukRow[];
  gudang: GudangRow[];
  penyesuaian: PenyesuaianRow[];
  kategori: KategoriRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("BARANG");
  const [sub, setSub] = useState<SubKey>("PRODUK");
  const [tindakanOpen, setTindakanOpen] = useState(false);
  const tindakanRef = useRef<HTMLDivElement>(null);

  // Daftar produk: cari + filter
  const [search, setSearch] = useState("");
  const [filterKategori, setFilterKategori] = useState("SEMUA");
  const [filterStatus, setFilterStatus] = useState("SEMUA");
  const [sort, setSort] = useState<"nama" | "terbaru">("nama");

  // Dialog produk
  const [produkOpen, setProdukOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProdukForm>(emptyProdukForm());
  const [saving, setSaving] = useState(false);
  const [produkMsg, setProdukMsg] = useState("");
  const [confirmHapusId, setConfirmHapusId] = useState<string | null>(null);

  // Penyesuaian stok
  const [sesuaiOpen, setSesuaiOpen] = useState(false);
  const [sesuaiProdukId, setSesuaiProdukId] = useState("");
  const [fisik, setFisik] = useState("");
  const [sesuaiKet, setSesuaiKet] = useState("");
  const [sesuaiSaving, setSesuaiSaving] = useState(false);
  const [sesuaiMsg, setSesuaiMsg] = useState("");

  // Gudang
  const [gudangSearch, setGudangSearch] = useState("");
  const [gudangOpen, setGudangOpen] = useState(false);
  const [gudangEditId, setGudangEditId] = useState<string | null>(null);
  const [gudangNama, setGudangNama] = useState("");
  const [gudangAlamat, setGudangAlamat] = useState("");
  const [gudangStatus, setGudangStatus] = useState("AKTIF");
  const [gudangSaving, setGudangSaving] = useState(false);
  const [gudangMsg, setGudangMsg] = useState("");

  // Kategori
  const [katOpen, setKatOpen] = useState(false);
  const [katDari, setKatDari] = useState("");
  const [katKe, setKatKe] = useState("");
  const [katSaving, setKatSaving] = useState(false);
  const [katMsg, setKatMsg] = useState("");

  // Import
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [importSaving, setImportSaving] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  // Aturan harga (UI tahap awal)
  const [hargaOpen, setHargaOpen] = useState(false);
  const [hargaSearch, setHargaSearch] = useState("");

  useEffect(() => {
    if (!tindakanOpen) return;
    const onDown = (e: PointerEvent) => {
      if (tindakanRef.current && !tindakanRef.current.contains(e.target as Node)) setTindakanOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTindakanOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [tindakanOpen]);

  const produkFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = produk.filter((p) => {
      if (filterKategori !== "SEMUA" && p.kategori !== filterKategori) return false;
      if (filterStatus !== "SEMUA" && p.status !== filterStatus) return false;
      if (q) {
        const hay = `${p.namaBarang} ${p.id} ${p.barcode ?? ""} ${p.kategori}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) =>
      sort === "nama"
        ? a.namaBarang.localeCompare(b.namaBarang, "id")
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [produk, search, filterKategori, filterStatus, sort]);

  const gudangFiltered = useMemo(() => {
    const q = gudangSearch.trim().toLowerCase();
    if (!q) return gudang;
    return gudang.filter((g) => `${g.kode} ${g.nama} ${g.alamat ?? ""}`.toLowerCase().includes(q));
  }, [gudang, gudangSearch]);

  const kategoriList = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of produk) set.set(p.kategori, (set.get(p.kategori) ?? 0) + 1);
    return [...set.entries()].sort((a, b) => a[0].localeCompare(b[0], "id"));
  }, [produk]);

  // ---------- Produk: simpan ----------
  const openTambah = () => {
    setEditingId(null);
    setForm(emptyProdukForm());
    setProdukMsg("");
    setConfirmHapusId(null);
    setProdukOpen(true);
    setTindakanOpen(false);
  };

  const openEdit = (r: ProdukRow) => {
    setEditingId(r.id);
    setForm(produkFormFromRow(r));
    setProdukMsg("");
    setConfirmHapusId(null);
    setProdukOpen(true);
  };

  const saveProduk = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setProdukMsg("");
    try {
      const isJasa = form.tipe === "JASA";
      const payload: Record<string, unknown> = {
        namaBarang: form.nama.trim(),
        kategori: form.kategori,
        satuan: form.satuan.trim(),
        keterangan: form.deskripsi.trim() || null,
        barcode: form.barcode.trim() || null,
        tipeProduk: form.tipe,
        hargaBeli: form.hargaBeli.trim() === "" ? null : Number(form.hargaBeli),
        hargaJual: form.hargaJual.trim() === "" ? null : Number(form.hargaJual),
      };
      if (!editingId) {
        payload.stokAwal = isJasa ? 0 : Math.max(0, Number(form.stokAwal) || 0);
        payload.batasMinimum = isJasa ? 0 : Math.max(0, Number(form.batasMinimum) || 0);
      } else {
        payload.batasMinimum = isJasa ? 0 : Math.max(0, Number(form.batasMinimum) || 0);
      }
      const url = editingId ? `/api/persediaan/${encodeURIComponent(editingId)}` : "/api/persediaan";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(fieldError(result, "Gagal menyimpan produk"));
      setProdukOpen(false);
      router.refresh();
    } catch (err) {
      setProdukMsg(err instanceof Error ? err.message : "Gagal menyimpan produk");
    } finally {
      setSaving(false);
    }
  };

  const hapusProduk = async (id: string) => {
    if (confirmHapusId !== id) {
      setConfirmHapusId(id);
      return;
    }
    setSaving(true);
    setProdukMsg("");
    try {
      const res = await fetch(`/api/persediaan/${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus produk");
      setConfirmHapusId(null);
      setProdukOpen(false);
      router.refresh();
    } catch (err) {
      setProdukMsg(err instanceof Error ? err.message : "Gagal menghapus produk");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Penyesuaian ----------
  const sesuaiProduk = produk.find((p) => p.id === sesuaiProdukId) ?? null;
  const sistem = sesuaiProduk?.stok ?? null;
  const selisih = sesuaiProduk && sistem != null && fisik.trim() !== "" ? Number(fisik) - sistem : null;

  const openSesuai = (presetId?: string) => {
    const barangSaja = produk.filter((p) => p.tipeProduk !== "JASA");
    setSesuaiProdukId(presetId ?? barangSaja[0]?.id ?? "");
    setFisik("");
    setSesuaiKet("");
    setSesuaiMsg("");
    setSesuaiOpen(true);
    setTindakanOpen(false);
  };

  const saveSesuai = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sesuaiProduk || sistem == null || selisih == null || selisih === 0) {
      setSesuaiMsg("Tidak ada selisih untuk disesuaikan (stok fisik sama dengan sistem).");
      return;
    }
    setSesuaiSaving(true);
    setSesuaiMsg("");
    try {
      const res = await fetch(`/api/persediaan/${encodeURIComponent(sesuaiProduk.id)}/riwayat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jenis: selisih > 0 ? "MASUK" : "KELUAR",
          jumlah: Math.abs(selisih),
          keterangan: `Opname: sistem ${sistem} → fisik ${fisik.trim()}${sesuaiKet.trim() ? ` | ${sesuaiKet.trim()}` : ""}`,
          sumber: "PENYESUAIAN",
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(fieldError(result, "Gagal menyimpan penyesuaian"));
      setSesuaiOpen(false);
      setSub("SESUAI");
      router.refresh();
    } catch (err) {
      setSesuaiMsg(err instanceof Error ? err.message : "Gagal menyimpan penyesuaian");
    } finally {
      setSesuaiSaving(false);
    }
  };

  // ---------- Gudang ----------
  const openGudangBaru = () => {
    setGudangEditId(null);
    setGudangNama("");
    setGudangAlamat("");
    setGudangStatus("AKTIF");
    setGudangMsg("");
    setGudangOpen(true);
    setTindakanOpen(false);
  };

  const openGudangEdit = (g: GudangRow) => {
    setGudangEditId(g.id);
    setGudangNama(g.nama);
    setGudangAlamat(g.alamat ?? "");
    setGudangStatus(g.status);
    setGudangMsg("");
    setGudangOpen(true);
  };

  const saveGudang = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGudangSaving(true);
    setGudangMsg("");
    try {
      const url = gudangEditId ? `/api/gudang/${encodeURIComponent(gudangEditId)}` : "/api/gudang";
      const res = await fetch(url, {
        method: gudangEditId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: gudangNama.trim(),
          alamat: gudangAlamat.trim() || null,
          ...(gudangEditId ? { status: gudangStatus } : {}),
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(fieldError(result, "Gagal menyimpan gudang"));
      setGudangOpen(false);
      router.refresh();
    } catch (err) {
      setGudangMsg(err instanceof Error ? err.message : "Gagal menyimpan gudang");
    } finally {
      setGudangSaving(false);
    }
  };

  const toggleGudang = async (g: GudangRow) => {
    try {
      const res = await fetch(`/api/gudang/${encodeURIComponent(g.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: g.status === "AKTIF" ? "NONAKTIF" : "AKTIF" }),
      });
      if (!res.ok) throw new Error("Gagal ubah status gudang");
      router.refresh();
    } catch {
      // status gagal: biarkan, user dapat mengulang
    }
  };

  // ---------- Kategori ----------
  const openKategori = () => {
    setKatDari((kategori[0]?.kategori ?? kategoriPersediaanList[0]) as string);
    setKatKe("");
    setKatMsg("");
    setKatOpen(true);
  };

  const saveKategori = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setKatSaving(true);
    setKatMsg("");
    try {
      const res = await fetch("/api/persediaan/kategori", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dari: katDari, ke: katKe.trim() }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Gagal ubah kategori");
      setKatOpen(false);
      router.refresh();
    } catch (err) {
      setKatMsg(err instanceof Error ? err.message : "Gagal ubah kategori");
    } finally {
      setKatSaving(false);
    }
  };

  // ---------- Import / Export ----------
  const handleImportFile = async (files: FileList | null) => {
    setImportMsg("");
    setImportRows([]);
    if (!files || files.length === 0) return;
    const text = await files[0].text().catch(() => "");
    if (!text.trim()) {
      setImportMsg("File kosong.");
      return;
    }
    const grid = parseCsv(text);
    if (grid.length < 2) {
      setImportMsg("Format: baris pertama header (nama, kode, kategori, satuan, stok, beli, jual).");
      return;
    }
    const head = grid[0].map((h) => h.trim().toLowerCase());
    const idx = (names: string[]) => {
      for (const n of names) {
        const i = head.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    const iNama = idx(["nama", "nama produk", "name"]);
    if (iNama < 0) {
      setImportMsg("Kolom 'nama' wajib ada di header CSV.");
      return;
    }
    const iKode = idx(["kode", "sku", "kode produk"]);
    const iKat = idx(["kategori", "kategori produk", "category"]);
    const iSat = idx(["satuan", "unit"]);
    const iStok = idx(["stok", "stok awal", "stock"]);
    const iBeli = idx(["beli", "harga beli", "buy"]);
    const iJual = idx(["jual", "harga jual", "sell"]);
    const rows = grid.slice(1).map((c) => ({
      nama: (c[iNama] ?? "").trim(),
      kode: iKode >= 0 ? (c[iKode] ?? "").trim().toUpperCase() : "",
      kategori: iKat >= 0 ? (c[iKat] ?? "").trim() : "",
      satuan: iSat >= 0 ? (c[iSat] ?? "").trim() : "",
      stokAwal: iStok >= 0 ? (c[iStok] ?? "").trim() : "",
      hargaBeli: iBeli >= 0 ? (c[iBeli] ?? "").trim() : "",
      hargaJual: iJual >= 0 ? (c[iJual] ?? "").trim() : "",
    })).filter((r) => r.nama !== "");
    if (rows.length === 0) {
      setImportMsg("Tidak ada baris berisi nama produk.");
      return;
    }
    setImportRows(rows);
  };

  const submitImport = async () => {
    if (importRows.length === 0) return;
    setImportSaving(true);
    setImportMsg("");
    try {
      const res = await fetch("/api/persediaan/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: importRows.map((r) => ({
            nama: r.nama,
            kode: r.kode || undefined,
            kategori: r.kategori || undefined,
            satuan: r.satuan || undefined,
            stokAwal: r.stokAwal === "" ? undefined : Number(r.stokAwal),
            hargaBeli: r.hargaBeli === "" ? undefined : Number(r.hargaBeli),
            hargaJual: r.hargaJual === "" ? undefined : Number(r.hargaJual),
          })),
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(fieldError(result, "Gagal import produk"));
      setImportMsg(result.message || "Import selesai");
      setImportRows([]);
      router.refresh();
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Gagal import produk");
    } finally {
      setImportSaving(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      "produk-pt-bst.csv",
      ["Kode", "Nama Produk", "Kategori", "Tipe", "Satuan", "Total Stok", "Batas Minimum", "Harga Rata-rata", "Harga Beli Terakhir", "Harga Beli", "Harga Jual"],
      produkFiltered.map((p) => [
        p.id, p.namaBarang, p.kategori, p.tipeProduk, p.satuan,
        p.stok ?? "-", p.batasMinimum,
        p.hargaRataRata ?? "-", p.hargaBeliTerakhir ?? "-", p.hargaBeli ?? "-", p.hargaJual ?? "-",
      ])
    );
  };

  const tindakanItem =
    "flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 cursor-pointer";
  const tabBtn = (active: boolean) =>
    `rounded-full px-4 py-1.5 transition-colors cursor-pointer ${active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Produk</h1>
          <p className="mt-1 text-sm text-slate-400">Master barang & jasa PT Bumi Surya Farm untuk Pembelian, Penjualan, dan Pengiriman.</p>
        </div>
        <div ref={tindakanRef} className="relative w-fit">
          <Button type="button" onClick={() => setTindakanOpen((v) => !v)} aria-haspopup="menu" aria-expanded={tindakanOpen} className="cursor-pointer">
            Tindakan <ChevronDown className={`h-4 w-4 transition-transform ${tindakanOpen ? "rotate-180" : ""}`} />
          </Button>
          {tindakanOpen && (
            <div role="menu" className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400">PRODUK</div>
              <button type="button" role="menuitem" className={tindakanItem} onClick={openTambah}>
                <Plus className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span><span className="block font-medium text-slate-900">Tambah Produk Baru</span><span className="block text-xs text-slate-500">Barang atau jasa baru</span></span>
              </button>
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400">GUDANG</div>
              <button type="button" role="menuitem" className={tindakanItem} onClick={openGudangBaru}>
                <Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span><span className="block font-medium text-slate-900">Tambah Gudang Baru</span><span className="block text-xs text-slate-500">Lokasi penyimpanan baru</span></span>
              </button>
              <button type="button" role="menuitem" className={tindakanItem} onClick={() => openSesuai()}>
                <Scale className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span><span className="block font-medium text-slate-900">Sesuaikan Stok</span><span className="block text-xs text-slate-500">Samakan sistem dengan fisik (opname)</span></span>
              </button>
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400">ATURAN HARGA</div>
              <button
                type="button"
                role="menuitem"
                className={`${tindakanItem} rounded-b-xl`}
                onClick={() => { setHargaOpen(true); setTindakanOpen(false); }}
              >
                <Tag className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span><span className="block font-medium text-slate-900">Buat Aturan Harga Baru</span><span className="block text-xs text-slate-500">Skema harga khusus (tahap awal)</span></span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab utama */}
      <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-medium">
        <button type="button" onClick={() => setTab("BARANG")} className={tabBtn(tab === "BARANG")}>Barang & Jasa · {produk.length}</button>
        <button type="button" onClick={() => setTab("GUDANG")} className={tabBtn(tab === "GUDANG")}>Gudang · {gudang.length}</button>
        <button type="button" onClick={() => setTab("HARGA")} className={tabBtn(tab === "HARGA")}>Aturan Harga</button>
      </div>

      {tab === "BARANG" && (
        <>
          {/* Ringkasan */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-200"><CardContent className="p-5">
              <div className="text-xs text-slate-400">Stok Tersedia</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{summary.tersedia} <span className="text-sm font-normal text-slate-400">jenis</span></div>
              <div className="mt-1 text-xs text-slate-400">Total {formatRupiah(summary.totalStok)} unit</div>
            </CardContent></Card>
            <Card className="border-amber-200 bg-amber-50/50"><CardContent className="p-5">
              <div className="text-xs text-amber-700">Stok Segera Habis</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-amber-700">{summary.segeraHabis} <span className="text-sm font-normal">jenis</span></div>
              <div className="mt-1 text-xs text-slate-400">Di bawah batas minimum</div>
            </CardContent></Card>
            <Card className="border-red-200 bg-red-50/50"><CardContent className="p-5">
              <div className="text-xs text-red-700">Stok Habis</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-red-700">{summary.habis} <span className="text-sm font-normal">jenis</span></div>
              <div className="mt-1 text-xs text-slate-400">Perlu pengadaan</div>
            </CardContent></Card>
            <Card className="border-slate-200"><CardContent className="p-5">
              <div className="text-xs text-slate-400">Gudang</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{summary.gudangAktif} <span className="text-sm font-normal text-slate-400">aktif</span></div>
              <div className="mt-1 text-xs text-slate-400">{summary.gudangTotal} total lokasi</div>
            </CardContent></Card>
          </div>

          {/* Sub tab */}
          <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-medium">
            <button type="button" onClick={() => setSub("PRODUK")} className={tabBtn(sub === "PRODUK")}>Daftar Produk · {produkFiltered.length}</button>
            <button type="button" onClick={() => setSub("SESUAI")} className={tabBtn(sub === "SESUAI")}>Daftar Penyesuaian Stok · {penyesuaian.length}</button>
            <button type="button" onClick={() => setSub("SETUJU")} className={tabBtn(sub === "SETUJU")}>Membutuhkan Persetujuan</button>
          </div>

          {sub === "PRODUK" && (
            <Card className="border-slate-200">
              <CardContent className="p-0">
                <div className="flex flex-col gap-2 border-b border-slate-100 p-4 lg:flex-row">
                  <div className="relative lg:max-w-xs lg:flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, kode, barcode" aria-label="Cari produk" className="pl-9 pr-9" />
                    {search && (
                      <button type="button" onClick={() => setSearch("")} aria-label="Bersihkan pencarian" className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)} className="lg:max-w-56" aria-label="Filter kategori">
                    <option value="SEMUA">Semua kategori</option>
                    {kategoriList.map(([k]) => (<option key={k} value={k}>{k}</option>))}
                  </Select>
                  <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="lg:max-w-48" aria-label="Filter status">
                    <option value="SEMUA">Semua status</option>
                    <option value="Tersedia">Tersedia</option>
                    <option value="Stok Menipis">Segera habis</option>
                    <option value="Habis">Habis</option>
                    <option value="Jasa">Jasa</option>
                  </Select>
                  <Select value={sort} onChange={(e) => setSort(e.target.value as "nama" | "terbaru")} className="lg:max-w-40" aria-label="Urutkan">
                    <option value="nama">Nama A–Z</option>
                    <option value="terbaru">Terbaru</option>
                  </Select>
                  <div className="flex flex-wrap gap-2 lg:ml-auto">
                    <Button type="button" variant="outline" size="sm" onClick={() => { setImportOpen(true); setImportMsg(""); setImportRows([]); }} className="cursor-pointer"><Upload className="h-3.5 w-3.5" /> Import</Button>
                    <Button type="button" variant="outline" size="sm" onClick={exportCsv} className="cursor-pointer"><FileSpreadsheet className="h-3.5 w-3.5" /> Export</Button>
                    <Button type="button" variant="outline" size="sm" onClick={openKategori} className="cursor-pointer">Atur Kategori</Button>
                  </div>
                </div>

                {/* Mobile */}
                <div className="grid gap-3 p-3 md:hidden">
                  {produkFiltered.length === 0 ? (
                    <ProdukEmpty hasData={produk.length > 0} onTambah={openTambah} />
                  ) : produkFiltered.map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-bold text-slate-900">{p.id}</div>
                          <div className="text-sm font-medium text-slate-900 truncate">{p.namaBarang}</div>
                          <div className="text-xs text-slate-500">{p.kategori} • {p.tipeProduk === "JASA" ? "Jasa" : p.satuan}</div>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Total Stok</div><div className="font-semibold">{p.stok == null ? "—" : `${formatRupiah(p.stok)} ${p.satuan}`}</div></div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Harga Jual</div><div className="font-semibold">{rp(p.hargaJual)}</div></div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                        {p.tipeProduk !== "JASA" && (
                          <Button variant="outline" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" onClick={() => openSesuai(p.id)}><Scale className="h-3.5 w-3.5" /> Sesuaikan</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <div className="min-w-[1240px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama Produk</TableHead>
                          <TableHead>Kode/SKU</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead className="text-right">Total Stok</TableHead>
                          <TableHead className="text-right">Batas Min.</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Harga Rata-rata</TableHead>
                          <TableHead className="text-right">Beli Terakhir</TableHead>
                          <TableHead className="text-right">Harga Beli</TableHead>
                          <TableHead className="text-right">Harga Jual</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {produkFiltered.length === 0 ? (
                          <TableRow><TableCell colSpan={11} className="py-8"><ProdukEmpty hasData={produk.length > 0} onTambah={openTambah} /></TableCell></TableRow>
                        ) : produkFiltered.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-900 max-w-[220px] truncate" title={p.namaBarang}>{p.namaBarang}</span>
                                <StatusBadge status={p.status} />
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{p.id}</TableCell>
                            <TableCell className="text-sm max-w-[160px] truncate" title={p.kategori}>{p.kategori}</TableCell>
                            <TableCell className="text-right text-sm font-semibold whitespace-nowrap">{p.stok == null ? <span className="font-normal text-slate-300">—</span> : formatRupiah(p.stok)}</TableCell>
                            <TableCell className="text-right text-sm text-slate-500 whitespace-nowrap">{p.tipeProduk === "JASA" ? "—" : formatRupiah(p.batasMinimum)}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">{p.satuan}</TableCell>
                            <TableCell className="text-right text-sm whitespace-nowrap">{rp(p.hargaRataRata)}</TableCell>
                            <TableCell className="text-right text-sm whitespace-nowrap">{rp(p.hargaBeliTerakhir)}</TableCell>
                            <TableCell className="text-right text-sm whitespace-nowrap">{rp(p.hargaBeli)}</TableCell>
                            <TableCell className="text-right text-sm whitespace-nowrap">{rp(p.hargaJual)}</TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full cursor-pointer" title="Edit produk" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                                {p.tipeProduk !== "JASA" && (
                                  <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full cursor-pointer" title="Sesuaikan stok" onClick={() => openSesuai(p.id)}><Scale className="h-3.5 w-3.5" /></Button>
                                )}
                                {canDelete && (
                                  confirmHapusId === p.id ? (
                                    <span className="flex items-center gap-1">
                                      <Button variant="destructive" size="sm" className="h-7 cursor-pointer" disabled={saving} onClick={() => hapusProduk(p.id)}><Check className="h-3.5 w-3.5" /> Ya</Button>
                                      <Button variant="ghost" size="sm" className="h-7 cursor-pointer" onClick={() => setConfirmHapusId(null)}>Batal</Button>
                                    </span>
                                  ) : (
                                    <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 cursor-pointer" title="Hapus produk" onClick={() => hapusProduk(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  )
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
                  {produkFiltered.length} dari {produk.length} produk · Harga rata-rata & beli terakhir dari faktur pembelian nyata
                </div>
              </CardContent>
            </Card>
          )}

          {sub === "SESUAI" && (
            <Card className="border-slate-200">
              <CardContent className="p-0">
                <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
                  <p className="text-xs text-slate-500">Selisih stock opname terhadap sistem. Bukan transaksi Kas/Bank.</p>
                  <Button type="button" size="sm" onClick={() => openSesuai()} className="sm:ml-auto w-fit cursor-pointer"><Scale className="h-3.5 w-3.5" /> Sesuaikan Stok</Button>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[720px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Produk</TableHead>
                          <TableHead className="text-right">Perubahan</TableHead>
                          <TableHead>Keterangan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {penyesuaian.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="py-8 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Scale className="h-5 w-5" /></span>
                              <p className="text-sm font-medium text-slate-500">Belum ada penyesuaian stok.</p>
                              <p className="text-xs text-slate-400">Catat selisih hasil opname lewat tombol “Sesuaikan Stok”.</p>
                            </div>
                          </TableCell></TableRow>
                        ) : penyesuaian.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs text-slate-500 whitespace-nowrap">{formatTanggal(r.tanggal)}</TableCell>
                            <TableCell className="text-sm font-medium">{r.barangNama} <span className="font-mono text-xs text-slate-400">{r.barangId}</span></TableCell>
                            <TableCell className={`text-right text-sm font-semibold whitespace-nowrap ${r.jenis === "MASUK" ? "text-green-700" : "text-red-600"}`}>
                              {r.jenis === "MASUK" ? "+" : "−"}{formatRupiah(r.jumlah)} {r.satuan}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-[320px] truncate" title={r.keterangan ?? ""}>{dash(r.keterangan)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">{penyesuaian.length} penyesuaian terakhir</div>
              </CardContent>
            </Card>
          )}

          {sub === "SETUJU" && (
            <Card className="border-slate-200">
              <CardContent className="p-8 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Check className="h-5 w-5" /></span>
                <p className="mt-3 text-sm font-medium text-slate-500">Belum ada yang membutuhkan persetujuan.</p>
                <p className="mt-1 text-xs text-slate-400">PT BST belum menggunakan workflow approval.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "GUDANG" && (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={gudangSearch} onChange={(e) => setGudangSearch(e.target.value)} placeholder="Cari kode / nama gudang" aria-label="Cari gudang" className="pl-9 pr-9" />
                {gudangSearch && (
                  <button type="button" onClick={() => setGudangSearch("")} aria-label="Bersihkan pencarian" className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button type="button" size="sm" onClick={openGudangBaru} className="sm:ml-auto w-fit cursor-pointer"><Plus className="h-3.5 w-3.5" /> Tambah Gudang Baru</Button>
            </div>
            <div className="grid gap-3 p-3 md:hidden">
              {gudangFiltered.length === 0 ? (
                <GudangEmpty onTambah={openGudangBaru} />
              ) : gudangFiltered.map((g) => (
                <div key={g.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-slate-900">{g.kode}</div>
                      <div className="text-sm font-medium text-slate-900 truncate">{g.nama}</div>
                      <div className="text-xs text-slate-500 truncate">{dash(g.alamat)}</div>
                    </div>
                    <Badge variant={g.status === "AKTIF" ? "sehat" : "secondary"}>{g.status === "AKTIF" ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" onClick={() => openGudangEdit(g)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button variant="outline" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" onClick={() => toggleGudang(g)}>{g.status === "AKTIF" ? "Nonaktifkan" : "Aktifkan"}</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <div className="min-w-[720px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama Gudang</TableHead>
                      <TableHead>Alamat</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gudangFiltered.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-8"><GudangEmpty onTambah={openGudangBaru} /></TableCell></TableRow>
                    ) : gudangFiltered.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{g.kode}</TableCell>
                        <TableCell className="text-sm font-medium">{g.nama}</TableCell>
                        <TableCell className="text-sm max-w-[280px] truncate" title={g.alamat ?? ""}>{dash(g.alamat)}</TableCell>
                        <TableCell><Badge variant={g.status === "AKTIF" ? "sehat" : "secondary"}>{g.status === "AKTIF" ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full cursor-pointer" title="Edit gudang" onClick={() => openGudangEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" className="h-8 cursor-pointer text-xs" title="Ubah status" onClick={() => toggleGudang(g)}>{g.status === "AKTIF" ? "Nonaktifkan" : "Aktifkan"}</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">{gudangFiltered.length} dari {gudang.length} gudang · Tanpa Transfer Gudang</div>
          </CardContent>
        </Card>
      )}

      {tab === "HARGA" && (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={hargaSearch} onChange={(e) => setHargaSearch(e.target.value)} placeholder="Cari aturan harga" aria-label="Cari aturan harga" className="pl-9" />
              </div>
              <Button type="button" size="sm" onClick={() => setHargaOpen(true)} className="sm:ml-auto w-fit cursor-pointer"><Plus className="h-3.5 w-3.5" /> Buat Aturan Harga Baru</Button>
            </div>
            <div className="p-8 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Tag className="h-5 w-5" /></span>
              <p className="mt-3 text-sm font-medium text-slate-500">Belum ada aturan harga.</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">PT BST memakai Harga Jual per produk. Aturan harga khusus yang kompleks belum dibutuhkan.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog produk */}
      <Dialog open={produkOpen} onOpenChange={(v) => { setProdukOpen(v); if (!v) setProdukMsg(""); }}>
        <DialogContent onClose={() => setProdukOpen(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
            <DialogDescription>Master produk bersama untuk Pembelian, Penjualan, dan Pengiriman.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveProduk} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 border-b border-slate-100 pb-1 text-xs font-semibold text-slate-700">Informasi Produk</div>
              <Field label="Nama produk" required className="sm:col-span-2">
                <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama produk" maxLength={100} required />
              </Field>
              <Field label="Kode produk / SKU">
                <Input value={editingId ? form.kode : "Otomatis (BRG-...)"} disabled className="bg-slate-50 font-mono text-slate-500" />
              </Field>
              <Field label="Barcode">
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Opsional" maxLength={50} />
              </Field>
              <Field label="Unit" required>
                <Input value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })} placeholder="kg / pcs / karung" maxLength={20} required />
              </Field>
              <Field label="Kategori produk" required>
                <Select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} required>
                  {kategoriPersediaanList.map((k) => (<option key={k} value={k}>{k}</option>))}
                  {!((kategoriPersediaanList as readonly string[]).includes(form.kategori)) && (
                    <option value={form.kategori}>{form.kategori} (lama)</option>
                  )}
                </Select>
              </Field>
              <Field label="Tipe produk" required className="sm:col-span-2">
                <Select value={form.tipe} disabled={Boolean(editingId)} onChange={(e) => setForm({ ...form, tipe: e.target.value as "BARANG" | "JASA" })}>
                  <option value="BARANG">Barang (stok terlacak)</option>
                  <option value="JASA">Jasa (tanpa stok)</option>
                </Select>
              </Field>
              <Field label="Deskripsi" className="sm:col-span-2">
                <Textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Deskripsi produk (opsional)" />
              </Field>
              <div className="sm:col-span-2 border-b border-slate-100 pb-1 pt-2 text-xs font-semibold text-slate-700">Informasi Harga</div>
              <Field label="Harga beli (Rp)">
                <Input type="number" min="0" step="any" value={form.hargaBeli} onChange={(e) => setForm({ ...form, hargaBeli: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Harga jual (Rp)">
                <Input type="number" min="0" step="any" value={form.hargaJual} onChange={(e) => setForm({ ...form, hargaJual: e.target.value })} placeholder="0" />
              </Field>
              {form.tipe === "BARANG" && (
                <>
                  <div className="sm:col-span-2 border-b border-slate-100 pb-1 pt-2 text-xs font-semibold text-slate-700">Informasi Persediaan</div>
                  {!editingId && (
                    <Field label="Stok awal">
                      <Input type="number" min="0" step="1" value={form.stokAwal} onChange={(e) => setForm({ ...form, stokAwal: e.target.value })} />
                    </Field>
                  )}
                  <Field label="Batas minimum stok">
                    <Input type="number" min="0" step="1" value={form.batasMinimum} onChange={(e) => setForm({ ...form, batasMinimum: e.target.value })} placeholder="0 = ikut ambang umum" />
                  </Field>
                </>
              )}
            </div>
            {produkMsg && <p className="text-sm text-red-600">{produkMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProdukOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Produk"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog penyesuaian */}
      <Dialog open={sesuaiOpen} onOpenChange={(v) => { setSesuaiOpen(v); if (!v) setSesuaiMsg(""); }}>
        <DialogContent onClose={() => setSesuaiOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sesuaikan Stok</DialogTitle>
            <DialogDescription>Samakan stok sistem dengan hasil opname fisik. Bukan transaksi Kas/Bank.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveSesuai} className="grid gap-4">
            <Field label="Produk" required>
              <Select value={sesuaiProdukId} onChange={(e) => setSesuaiProdukId(e.target.value)} required>
                <option value="">Pilih produk</option>
                {produk.filter((p) => p.tipeProduk !== "JASA").map((p) => (
                  <option key={p.id} value={p.id}>{p.namaBarang} ({p.id})</option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-slate-50 px-2 py-2.5"><div className="text-[11px] text-slate-400">Sistem</div><div className="text-sm font-semibold">{sistem == null ? "—" : `${formatRupiah(sistem)} ${sesuaiProduk?.satuan ?? ""}`}</div></div>
              <div className="rounded-lg bg-slate-50 px-2 py-2.5"><div className="text-[11px] text-slate-400">Fisik *</div>
                <Input type="number" min="0" step="1" value={fisik} onChange={(e) => setFisik(e.target.value)} className="mt-1 text-center" required />
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-2.5"><div className="text-[11px] text-slate-400">Selisih</div>
                <div className={`text-sm font-semibold ${selisih == null || selisih === 0 ? "" : selisih > 0 ? "text-green-700" : "text-red-600"}`}>
                  {selisih == null ? "—" : `${selisih > 0 ? "+" : ""}${formatRupiah(selisih)}`}
                </div>
              </div>
            </div>
            <Field label="Keterangan">
              <Input value={sesuaiKet} onChange={(e) => setSesuaiKet(e.target.value)} placeholder="Berita acara opname (opsional)" maxLength={300} />
            </Field>
            {sesuaiMsg && <p className="text-sm text-red-600">{sesuaiMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSesuaiOpen(false)}>Batal</Button>
              <Button type="submit" disabled={sesuaiSaving}>{sesuaiSaving ? "Menyimpan..." : "Simpan Penyesuaian"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog gudang */}
      <Dialog open={gudangOpen} onOpenChange={(v) => { setGudangOpen(v); if (!v) setGudangMsg(""); }}>
        <DialogContent onClose={() => setGudangOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{gudangEditId ? "Edit Gudang" : "Tambah Gudang Baru"}</DialogTitle>
            <DialogDescription>Lokasi penyimpanan PT Bumi Surya Farm.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveGudang} className="grid gap-4">
            <Field label="Nama gudang" required>
              <Input value={gudangNama} onChange={(e) => setGudangNama(e.target.value)} placeholder="Gudang Utama" maxLength={100} required />
            </Field>
            {gudangEditId && (
              <Field label="Status">
                <Select value={gudangStatus} onChange={(e) => setGudangStatus(e.target.value)}>
                  <option value="AKTIF">Aktif</option>
                  <option value="NONAKTIF">Nonaktif</option>
                </Select>
              </Field>
            )}
            <Field label="Alamat">
              <Textarea value={gudangAlamat} onChange={(e) => setGudangAlamat(e.target.value)} placeholder="Alamat gudang (opsional)" />
            </Field>
            {!gudangEditId && <p className="text-[11px] text-slate-400">Kode gudang terisi otomatis (GDG-...).</p>}
            {gudangMsg && <p className="text-sm text-red-600">{gudangMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setGudangOpen(false)}>Batal</Button>
              <Button type="submit" disabled={gudangSaving}>{gudangSaving ? "Menyimpan..." : gudangEditId ? "Simpan Perubahan" : "Tambah Gudang"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog kategori */}
      <Dialog open={katOpen} onOpenChange={(v) => { setKatOpen(v); if (!v) setKatMsg(""); }}>
        <DialogContent onClose={() => setKatOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atur Kategori Produk</DialogTitle>
            <DialogDescription>Kategori baku terhubung mapping COA persediaan.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {kategori.map((k) => (
              <div key={k.kategori} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{k.kategori}</span>
                <span className="text-xs text-slate-400">{k.jumlahProduk} produk</span>
              </div>
            ))}
            {kategori.length === 0 && <p className="text-sm text-slate-400">Belum ada kategori.</p>}
          </div>
          <form onSubmit={saveKategori} className="grid gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-600">Ganti nama kategori (berlaku untuk semua produknya)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dari">
                <Select value={katDari} onChange={(e) => setKatDari(e.target.value)}>
                  {kategori.map((k) => (<option key={k.kategori} value={k.kategori}>{k.kategori}</option>))}
                </Select>
              </Field>
              <Field label="Ke" required>
                <Input value={katKe} onChange={(e) => setKatKe(e.target.value)} placeholder="Nama baru" maxLength={50} required />
              </Field>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-700">Mengganti kategori baku memutus mapping COA-nya; produk memakai akun Beban 5402 saat difaktur.</p>
            {katMsg && <p className="text-sm text-red-600">{katMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setKatOpen(false)}>Tutup</Button>
              <Button type="submit" disabled={katSaving}>{katSaving ? "Menyimpan..." : "Ganti Nama"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog import */}
      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) { setImportMsg(""); setImportRows([]); } }}>
        <DialogContent onClose={() => setImportOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Produk</DialogTitle>
            <DialogDescription>CSV dengan header: nama, kode, kategori, satuan, stok, beli, jual.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input type="file" accept=".csv,text/csv" onChange={(e) => handleImportFile(e.target.files)} />
            {importRows.length > 0 && <p className="text-sm text-slate-600">{importRows.length} baris siap diimport.</p>}
            {importMsg && <p className="text-sm text-slate-600">{importMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Tutup</Button>
              <Button type="button" disabled={importSaving || importRows.length === 0} onClick={submitImport}>
                {importSaving ? "Mengimport..." : `Import ${importRows.length} Produk`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog aturan harga (tahap awal: UI saja) */}
      <Dialog open={hargaOpen} onOpenChange={setHargaOpen}>
        <DialogContent onClose={() => setHargaOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Aturan Harga Baru</DialogTitle>
            <DialogDescription>Skema harga khusus ala Mekari, disesuaikan PT BST.</DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-slate-600">
            Aturan harga kompleks belum dibutuhkan PT BST. Harga jual saat ini diatur
            per produk melalui <span className="font-medium">Edit Produk → Harga Jual</span>.
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setHargaOpen(false)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: ProdukRow["status"] }) {
  const variant: Record<ProdukRow["status"], "success" | "warning" | "destructive" | "secondary"> = {
    Tersedia: "success",
    "Stok Menipis": "warning",
    Habis: "destructive",
    Jasa: "secondary",
  };
  return <Badge variant={variant[status]}>{status === "Stok Menipis" ? "Segera Habis" : status}</Badge>;
}

function ProdukEmpty({ hasData, onTambah }: { hasData: boolean; onTambah: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <PackageSearch className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-500">
        {hasData ? "Tidak ada produk yang cocok dengan filter" : "Belum ada produk."}
      </p>
      {!hasData && (
        <>
          <p className="mt-1 text-xs text-slate-400">Tambahkan produk pertama PT Bumi Surya Farm.</p>
          <Button type="button" size="sm" onClick={onTambah} className="mt-3 cursor-pointer"><Plus className="h-3.5 w-3.5" /> Tambah Produk Baru</Button>
        </>
      )}
    </div>
  );
}

function GudangEmpty({ onTambah }: { onTambah: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Warehouse className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-500">Belum ada gudang.</p>
      <p className="mt-1 text-xs text-slate-400">Tambahkan lokasi penyimpanan pertama.</p>
      <Button type="button" size="sm" onClick={onTambah} className="mt-3 cursor-pointer"><Plus className="h-3.5 w-3.5" /> Tambah Gudang Baru</Button>
    </div>
  );
}
