"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, Minus, Sprout, ImagePlus, Loader2 } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

export type BibitItem = {
  id: string;
  namaBarang: string;
  satuan: string;
  stok: number;
  hargaSatuan: number;
  hargaJual: number | null;
  fotoUrl: string | null;
  keterangan: string | null;
  batasMinimum: number;
  status: "Tersedia" | "Stok Menipis" | "Habis";
};

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function hargaTampil(b: BibitItem) {
  return b.hargaJual ?? b.hargaSatuan;
}

function statusClass(s: BibitItem["status"]) {
  if (s === "Tersedia") return "bg-green-100 text-green-800";
  if (s === "Stok Menipis") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-500";
}

// Upload 1 foto -> URL (folder produk). Dipakai form tambah & edit.
async function uploadFoto(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("folder", "produk");
  const res = await fetch("/api/upload", { method: "POST", headers: { ...authHeader() }, body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || "Gagal upload foto");
  const url = j.data?.url as string | undefined;
  if (!url) throw new Error("Upload tidak mengembalikan URL");
  return url;
}

function FotoInput({
  value, onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadFoto(f);
      onChange(url);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>Foto bibit</Label>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="sr-only" tabIndex={-1}
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }} />
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Foto bibit" className="h-full w-full object-cover" />
          ) : (
            <Sprout className="h-6 w-6 text-slate-300" />
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {uploading ? "Mengupload..." : value ? "Ganti" : "Upload"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="rounded-full text-red-600" onClick={() => onChange(null)}>
              Hapus
            </Button>
          )}
        </div>
      </div>
      {err && <div className="text-xs text-red-600">{err}</div>}
    </div>
  );
}

export function TambahBibitForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState("");
  const [harga, setHarga] = useState("");
  const [satuan, setSatuan] = useState("polybag");
  const [stok, setStok] = useState("");
  const [ket, setKet] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/perkebunan/bibit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          namaBarang: nama,
          satuan,
          hargaJual: harga === "" ? undefined : Number(harga),
          stokAwal: stok === "" ? 0 : Number(stok),
          keterangan: ket || undefined,
          fotoUrl: foto,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Gagal simpan");
      setNama(""); setHarga(""); setSatuan("polybag"); setStok(""); setKet(""); setFoto(null);
      setOpen(false);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className="rounded-full bg-green-700 hover:bg-green-800 h-9 px-3.5 text-xs sm:h-10 sm:px-4 sm:text-sm cursor-pointer shadow-sm">
        + Tambah Bibit
      </Button>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">Tambah Bibit</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nama bibit *</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Bibit Durian Montong" required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Harga jual (Rp) *</Label>
            <Input type="number" min="0" value={harga} onChange={(e) => setHarga(e.target.value)} placeholder="35000" required className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Satuan *</Label>
              <Input value={satuan} onChange={(e) => setSatuan(e.target.value)} placeholder="polybag" required className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Stok awal</Label>
              <Input type="number" min="0" step="1" value={stok} onChange={(e) => setStok(e.target.value)} placeholder="0" className="h-11" />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Keterangan</Label>
            <Input value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Tinggi ±40cm, siap tanam" className="h-11" />
          </div>
          <div className="sm:col-span-2">
            <FotoInput value={foto} onChange={setFoto} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 rounded-full h-11">Batal</Button>
            <Button type="submit" disabled={loading} className="flex-1 rounded-full h-11 bg-green-700 hover:bg-green-800">
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
          {err && <div className="sm:col-span-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}
        </form>
      </CardContent>
    </Card>
  );
}

function EditDialog({ item, onClose, onSaved }: { item: BibitItem; onClose: () => void; onSaved: () => void }) {
  const [nama, setNama] = useState(item.namaBarang);
  const [harga, setHarga] = useState(String(hargaTampil(item)));
  const [satuan, setSatuan] = useState(item.satuan);
  const [ket, setKet] = useState(item.keterangan ?? "");
  const [foto, setFoto] = useState<string | null>(item.fotoUrl);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/perkebunan/bibit/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ namaBarang: nama, hargaJual: Number(harga), satuan, keterangan: ket || null, fotoUrl: foto }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Gagal simpan");
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit {item.id}</DialogTitle>
          <DialogDescription className="text-xs">Ubah data & foto bibit — langsung tampil di katalog.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="space-y-2">
            <Label>Nama bibit *</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} required className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Harga jual (Rp) *</Label>
              <Input type="number" min="0" value={harga} onChange={(e) => setHarga(e.target.value)} required className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Satuan *</Label>
              <Input value={satuan} onChange={(e) => setSatuan(e.target.value)} required className="h-11" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Keterangan</Label>
            <Input value={ket} onChange={(e) => setKet(e.target.value)} className="h-11" />
          </div>
          <FotoInput value={foto} onChange={setFoto} />
          {err && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-full h-11">Batal</Button>
            <Button type="submit" disabled={loading} className="flex-1 rounded-full h-11 bg-green-700 hover:bg-green-800">
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StokDialog({ item, onClose, onSaved }: { item: BibitItem; onClose: () => void; onSaved: () => void }) {
  const [jenis, setJenis] = useState<"MASUK" | "KELUAR">("MASUK");
  const [jumlah, setJumlah] = useState("");
  const [ket, setKet] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/perkebunan/bibit/${encodeURIComponent(item.id)}/stok`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ jenis, jumlah: Number(jumlah), keterangan: ket || undefined, sumber: "PENYESUAIAN" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Gagal update stok");
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal update stok");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Update stok — {item.namaBarang}</DialogTitle>
          <DialogDescription className="text-xs">Stok saat ini: {item.stok} {item.satuan}. Tanpa jurnal keuangan.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            {(["MASUK", "KELUAR"] as const).map((k) => (
              <Button key={k} type="button" variant={jenis === k ? "default" : "outline"}
                onClick={() => setJenis(k)}
                className={`rounded-full h-11 ${jenis === k ? (k === "MASUK" ? "bg-green-700 hover:bg-green-800" : "bg-red-600 hover:bg-red-700") : ""}`}>
                {k === "MASUK" ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />} {k === "MASUK" ? "Masuk" : "Keluar"}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Jumlah *</Label>
            <Input type="number" min="1" step="1" value={jumlah} onChange={(e) => setJumlah(e.target.value)} placeholder="10" required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Keterangan</Label>
            <Input value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Opname mingguan / bibit baru datang" className="h-11" />
          </div>
          {err && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-full h-11">Batal</Button>
            <Button type="submit" disabled={loading} className="flex-1 rounded-full h-11 bg-green-700 hover:bg-green-800">
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BibitGrid({ items }: { items: BibitItem[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<BibitItem | null>(null);
  const [stok, setStok] = useState<BibitItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function hapus(id: string) {
    if (!confirm(`Hapus ${id} beserta riwayat stoknya?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/perkebunan/bibit/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { ...authHeader() },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Gagal hapus");
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Gagal hapus");
    } finally {
      setDeleting(null);
    }
  }

  if (items.length === 0) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-10 text-center">
          <Sprout className="mx-auto h-8 w-8 text-slate-300" />
          <div className="mt-3 text-sm font-medium text-slate-900">Belum ada bibit</div>
          <div className="mt-1 text-xs text-slate-500">Tambah bibit pertama — otomatis tampil di katalog home.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((b) => (
          <Card key={b.id} className="overflow-hidden border-slate-200">
            <div className="relative aspect-[4/3] bg-slate-50 flex items-center justify-center overflow-hidden">
              {b.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.fotoUrl} alt={b.namaBarang} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <Sprout className="h-10 w-10 text-slate-300" />
              )}
              <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(b.status)}`}>
                {b.status}
              </span>
            </div>
            <CardContent className="p-3 sm:p-4 space-y-1">
              <div className="font-mono text-[11px] text-slate-400">{b.id}</div>
              <div className="text-sm font-medium text-slate-900 truncate">{b.namaBarang}</div>
              <div className="text-sm font-semibold text-green-800">Rp {formatRupiah(hargaTampil(b))} <span className="text-xs font-normal text-slate-400">/{b.satuan}</span></div>
              <div className="text-xs text-slate-500">Stok: {b.stok} {b.satuan}</div>
              <div className="flex gap-1.5 pt-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-full h-9 text-xs" onClick={() => setStok(b)}>
                  <Plus className="h-3.5 w-3.5" /> Stok
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={() => setEdit(b)} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-red-600" disabled={deleting === b.id} onClick={() => hapus(b.id)} title="Hapus">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {edit && <EditDialog item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); router.refresh(); }} />}
      {stok && <StokDialog item={stok} onClose={() => setStok(null)} onSaved={() => { setStok(null); router.refresh(); }} />}
    </>
  );
}
