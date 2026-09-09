"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TambahPohonPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    id: "",
    namaPohon: "",
    varietas: "",
    jenis: "",
    lokasiBlok: "",
    tanggalTanam: "",
    koordinat: "",
    hasilPanen: "",
    pemupukan: "",
    pengobatan: "",
    status: "SEHAT",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onChange = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const payload: any = {
        id: form.id.toUpperCase(),
        namaPohon: form.namaPohon || null,
        varietas: form.varietas,
        jenis: form.jenis || null,
        lokasiBlok: form.lokasiBlok,
        tanggalTanam: form.tanggalTanam,
        koordinat: form.koordinat || null,
        pemupukan: form.pemupukan || null,
        pengobatan: form.pengobatan || null,
        status: form.status,
      };
      if (form.hasilPanen !== "" && form.hasilPanen != null) payload.hasilPanen = Number(form.hasilPanen);

      const res = await fetch("/api/pohon", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || j.error || "Gagal tambah pohon");
      setMsg(`Berhasil: ${j.data?.id || form.id} ditambahkan`);
      setTimeout(() => router.push("/admin/pertanian/pohon"), 1200);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/pertanian/pohon">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Tambah Data Pohon — 11 Field</h1>
          <p className="text-sm text-slate-500">NO auto • USIA auto • RIWAYAT via scan terpisah</p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-green-700" /> Form 11 Field Pohon
          </CardTitle>
          <CardDescription>ID PHN-* • Koordinat -2.98, 104.75 • Hasil KG desimal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="id">ID Pohon *</Label>
                <Input id="id" value={form.id} onChange={(e) => onChange("id", e.target.value)} placeholder="PHN-BLK-A03" required pattern="PHN-[A-Z0-9-]+" title="Format PHN-*" />
                <p className="text-xs text-slate-400">Format: PHN-BLK-A01</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="namaPohon">2. NAMA POHON</Label>
                <Input id="namaPohon" value={form.namaPohon} onChange={(e) => onChange("namaPohon", e.target.value)} placeholder="Pohon Sawit 003" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="varietas">Varietas *</Label>
                <Input id="varietas" value={form.varietas} onChange={(e) => onChange("varietas", e.target.value)} placeholder="Sawit DxP" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jenis">3. JENIS</Label>
                <Input id="jenis" value={form.jenis} onChange={(e) => onChange("jenis", e.target.value)} placeholder="Sawit / Durian / Karet" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lokasiBlok">6. BLOK *</Label>
                <Input id="lokasiBlok" value={form.lokasiBlok} onChange={(e) => onChange("lokasiBlok", e.target.value)} placeholder="Blok A" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tanggalTanam">5. TANGGAL TANAM *</Label>
                <Input id="tanggalTanam" type="date" value={form.tanggalTanam} onChange={(e) => onChange("tanggalTanam", e.target.value)} required />
                <p className="text-xs text-slate-400">9. USIA POHON auto dari tanggal ini</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="koordinat">7. KOORDINAT</Label>
                <Input id="koordinat" value={form.koordinat} onChange={(e) => onChange("koordinat", e.target.value)} placeholder="-2.983, 104.752" />
                <p className="text-xs text-slate-400">Format: lat, lng — klik di tabel ke Maps</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hasilPanen">8. HASIL PANEN (KG)</Label>
                <Input id="hasilPanen" type="number" step="0.1" min="0" value={form.hasilPanen} onChange={(e) => onChange("hasilPanen", e.target.value)} placeholder="125.5" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pemupukan">10. PEMUPUKAN</Label>
              <Textarea id="pemupukan" value={form.pemupukan} onChange={(e) => onChange("pemupukan", e.target.value)} placeholder="NPK 2kg - 2026-01-15" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pengobatan">11. PENGOBATAN</Label>
              <Textarea id="pengobatan" value={form.pengobatan} onChange={(e) => onChange("pengobatan", e.target.value)} placeholder="Fungisida 2ml/L - Sehat" rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => onChange("status", e.target.value)}>
                <option value="SEHAT">SEHAT</option>
                <option value="PERLU_PERHATIAN">PERLU PERHATIAN</option>
                <option value="SAKIT">SAKIT</option>
                <option value="MATI">MATI</option>
              </Select>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500">
              <div>1. NO = auto nomor urut di tabel</div>
              <div>4. RIWAYAT PENYAKIT = via menu Scan/Input Kesehatan (riwayat terpisah)</div>
              <div>9. USIA POHON = auto hitung dari TANGGAL TANAM</div>
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-800 h-12 text-base">
              {loading ? "Menyimpan..." : "Simpan Data Pohon"}
            </Button>
            {msg && (
              <div className="rounded-lg bg-green-50 border border-green-300 p-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {msg}
              </div>
            )}
            {err && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
