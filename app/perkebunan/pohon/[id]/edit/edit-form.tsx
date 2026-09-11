"use client";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ArrowLeft, Pencil, Sprout, Camera, Upload, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  pohon: {
    id: string;
    namaPohon: string;
    varietas: string;
    jenis: string;
    lokasiBlok: string;
    tanggalTanam: string;
    koordinat: string;
    status: string;
    hasilPanen: string;
    pemupukan: string;
    pengobatan: string;
  };
  riwayat: { id: string; gejala: string; tindakan: string; fotoUrl: string | null; tanggalCek: string; petugasNama: string }[];
};

export function EditMasterForm({ pohon, riwayat }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(pohon);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // riwayat admin
  const [gejala, setGejala] = useState("");
  const [tindakan, setTindakan] = useState("");
  const [tanggalCek, setTanggalCek] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rLoading, setRLoading] = useState(false);
  const [rMsg, setRMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onChange = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  };

  const hasMasterChange =
    form.namaPohon !== pohon.namaPohon ||
    form.varietas !== pohon.varietas ||
    form.jenis !== pohon.jenis ||
    form.lokasiBlok !== pohon.lokasiBlok ||
    form.tanggalTanam !== pohon.tanggalTanam ||
    form.koordinat !== pohon.koordinat ||
    form.status !== pohon.status;
  const hasSnapshotChange =
    form.hasilPanen !== pohon.hasilPanen ||
    form.pemupukan !== pohon.pemupukan ||
    form.pengobatan !== pohon.pengobatan;

  async function submitAll(e: React.FormEvent) {
    e.preventDefault();
    if (!hasMasterChange && !hasSnapshotChange) {
      setErr("Tidak ada perubahan — ubah field dulu");
      return;
    }
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      // 1. Master (varietas/jenis/blok/tanggal/koordinat/nama/status)
      if (hasMasterChange) {
        const payload: any = {};
        if (form.namaPohon !== pohon.namaPohon) payload.namaPohon = form.namaPohon || null;
        if (form.varietas !== pohon.varietas) payload.varietas = form.varietas;
        if (form.jenis !== pohon.jenis) payload.jenis = form.jenis || null;
        if (form.lokasiBlok !== pohon.lokasiBlok) payload.lokasiBlok = form.lokasiBlok;
        if (form.tanggalTanam !== pohon.tanggalTanam) payload.tanggalTanam = form.tanggalTanam;
        if (form.koordinat !== pohon.koordinat) payload.koordinat = form.koordinat || null;
        if (form.status !== pohon.status) payload.status = form.status;
        const res = await fetch(`/api/pohon/${pohon.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.message || j.error || "Gagal update master");
      }
      // 2. Snapshot lapangan (hasilPanen/pemupukan/pengobatan) — admin full control
      if (hasSnapshotChange) {
        const payload: any = {};
        if (form.hasilPanen !== pohon.hasilPanen) payload.hasilPanen = form.hasilPanen === "" ? null : Number(form.hasilPanen);
        if (form.pemupukan !== pohon.pemupukan) payload.pemupukan = form.pemupukan || null;
        if (form.pengobatan !== pohon.pengobatan) payload.pengobatan = form.pengobatan || null;
        // status sudah handle di master, tapi jika hanya snapshot change tanpa master status, tetap kirim jika beda
        if (!hasMasterChange && form.status !== pohon.status) payload.status = form.status;
        if (Object.keys(payload).length > 0) {
          const res2 = await fetch(`/api/pohon/${pohon.id}/lapangan`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          const j2 = await res2.json();
          if (!res2.ok) throw new Error(j2.message || "Gagal update snapshot lapangan");
        }
      }
      setMsg("Berhasil — semua perubahan tersimpan");
      setTimeout(() => router.push("/perkebunan/pohon"), 900);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitRiwayat(e: React.FormEvent) {
    e.preventDefault();
    setRLoading(true);
    setRMsg(null);
    try {
      const token = localStorage.getItem("token") || "";
      if (!gejala.trim() || gejala.trim().length < 5) throw new Error("Gejala minimal 5 huruf");
      if (!tindakan.trim() || tindakan.trim().length < 5) throw new Error("Tindakan minimal 5 huruf");
      const fd = new FormData();
      fd.set("gejala", gejala.trim());
      fd.set("tindakan", tindakan.trim());
      if (tanggalCek) fd.set("tanggalCek", tanggalCek);
      if (file) fd.set("foto", file);
      const res = await fetch(`/api/pohon/${pohon.id}/riwayat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Gagal simpan riwayat");
      setRMsg("Riwayat berhasil ditambahkan");
      setGejala("");
      setTindakan("");
      setFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => window.location.reload(), 700);
    } catch (e: any) {
      setRMsg(e.message);
    } finally {
      setRLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* MASTER + SNAPSHOT — SATU FORM ADMIN “SEMUANYA” */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Pencil className="h-4 w-4 text-slate-700" /> Koreksi Data Pohon — {pohon.id} (Admin)
          </CardTitle>
          <CardDescription>Semua field bisa dikoreksi — ID read-only. Snapshot lapangan (panen/pupuk/obat) ada di bawah.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitAll} className="space-y-6">
            <div className="space-y-2">
              <Label>ID Pohon (read-only)</Label>
              <Input value={pohon.id} disabled className="font-mono bg-slate-50" />
            </div>

            <div>
              <div className="text-xs font-semibold tracking-widest text-slate-500 mb-2">IDENTITAS</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>NAMA POHON</Label>
                  <Input value={form.namaPohon} onChange={(e) => onChange("namaPohon", e.target.value)} placeholder="Pohon Sawit 001" />
                </div>
                <div className="space-y-2">
                  <Label>Varietas *</Label>
                  <Input value={form.varietas} onChange={(e) => onChange("varietas", e.target.value)} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <Label>JENIS</Label>
                  <Input value={form.jenis} onChange={(e) => onChange("jenis", e.target.value)} placeholder="Sawit / Durian" />
                </div>
                <div className="space-y-2">
                  <Label>BLOK *</Label>
                  <Input value={form.lokasiBlok} onChange={(e) => onChange("lokasiBlok", e.target.value)} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <Label>TANGGAL TANAM *</Label>
                  <Input type="date" value={form.tanggalTanam} onChange={(e) => onChange("tanggalTanam", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>KOORDINAT</Label>
                  <Input value={form.koordinat} onChange={(e) => onChange("koordinat", e.target.value)} placeholder="-2.983, 104.752" />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label>Status</Label>
                <Select value={form.status} onChange={(e) => onChange("status", e.target.value)}>
                  <option value="SEHAT">SEHAT</option>
                  <option value="PERLU_PERHATIAN">PERLU PERHATIAN</option>
                  <option value="SAKIT">SAKIT</option>
                  <option value="MATI">MATI</option>
                </Select>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Sprout className="h-4 w-4 text-emerald-700" />
                <div className="text-xs font-semibold tracking-widest text-slate-500">SNAPSHOT LAPANGAN (admin koreksi)</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Hasil Panen (KG)</Label>
                  <Input type="number" step="0.1" inputMode="decimal" value={form.hasilPanen} onChange={(e) => onChange("hasilPanen", e.target.value)} placeholder="125.5" className="bg-white" />
                  <p className="text-xs text-slate-400">Kosongkan jika belum panen</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400">Preview</Label>
                  <div className="h-10 flex items-center rounded-lg border bg-slate-50 px-3 text-sm font-medium">{form.hasilPanen ? `${form.hasilPanen} KG` : "—"}</div>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label>Pemupukan</Label>
                <Textarea value={form.pemupukan} onChange={(e) => onChange("pemupukan", e.target.value)} placeholder="NPK 2kg - 2026-01-15" rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Pengobatan</Label>
                <Textarea value={form.pengobatan} onChange={(e) => onChange("pengobatan", e.target.value)} placeholder="Fungisida 2ml/L - Sehat" rows={2} />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Link href="/perkebunan/pohon" className="flex-1">
                <Button type="button" variant="outline" className="w-full rounded-full">
                  <ArrowLeft className="h-4 w-4" /> Kembali
                </Button>
              </Link>
              <Button type="submit" disabled={loading} className="flex-1 bg-slate-900 hover:bg-slate-800 rounded-full">
                {loading ? "Menyimpan..." : <><Save className="h-4 w-4" /> Simpan Semua</>}
              </Button>
            </div>
            {msg && (
              <div className="rounded-lg bg-green-50 border border-green-300 p-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {msg}
              </div>
            )}
            {err && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}
          </form>
        </CardContent>
      </Card>

      {/* RIWAYAT ADMIN */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Camera className="h-4 w-4" /> Tambah Riwayat (Admin)</CardTitle>
          <CardDescription>Koreksi gejala/tindakan historis — optional, petugas tetap input harian di /petugas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitRiwayat} className="space-y-4">
            <div className="space-y-2">
              <Label>Tanggal Cek (opsional)</Label>
              <Input type="date" value={tanggalCek} onChange={(e) => setTanggalCek(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Gejala *</Label>
              <Textarea value={gejala} onChange={(e) => setGejala(e.target.value)} placeholder="Daun menguning..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Tindakan *</Label>
              <Textarea value={tindakan} onChange={(e) => setTindakan(e.target.value)} placeholder="Semprot fungisida..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Foto (opsional)</Label>
              <Input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="bg-white" />
              {preview && <img src={preview} alt="preview" className="mt-2 h-48 w-full object-cover rounded-lg border" />}
            </div>
            <Button type="submit" disabled={rLoading} className="w-full bg-slate-900 hover:bg-slate-800 h-11">
              {rLoading ? "Mengupload..." : <><Upload className="h-4 w-4" /> Simpan Riwayat</>}
            </Button>
            {rMsg && <div className="rounded-lg bg-slate-100 border p-3 text-sm text-slate-700">{rMsg}</div>}
          </form>
        </CardContent>
      </Card>

      {/* HISTORY */}
      <Card className="border-slate-100">
        <CardHeader>
          <CardTitle className="text-sm">History 10 Terbaru — {pohon.id}</CardTitle>
          <CardDescription>{riwayat.length} entri</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {riwayat.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-400">Belum ada riwayat</div>
          ) : (
            riwayat.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{new Date(r.tanggalCek).toLocaleDateString("id-ID")} • {r.petugasNama}</span>
                  {r.fotoUrl && <a href={r.fotoUrl} target="_blank" className="font-medium text-slate-900 hover:underline">Foto →</a>}
                </div>
                <div className="mt-2 text-sm font-medium text-slate-900">{r.gejala}</div>
                <div className="text-xs text-slate-500">→ {r.tindakan}</div>
                {r.fotoUrl && <img src={r.fotoUrl} alt="foto" className="mt-3 h-36 w-full object-cover rounded-xl" />}
              </div>
            ))
          )}
          <div className="flex gap-2">
            <Link href="/perkebunan/pohon" className="flex-1"><Button variant="outline" className="w-full rounded-full">Kembali ke Data Pohon</Button></Link>
            <Link href="/perkebunan/riwayat" className="flex-1"><Button variant="outline" className="w-full rounded-full">Log Global</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
