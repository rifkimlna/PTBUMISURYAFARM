"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sprout, Camera, Upload } from "lucide-react";
import Link from "next/link";

export function LapanganClient({
  pohon,
  riwayat,
}: {
  pohon: { id: string; hasilPanen: string; pemupukan: string; pengobatan: string; status: string };
  riwayat: { id: string; gejala: string; tindakan: string; fotoUrl: string | null; tanggalCek: string; petugasNama: string }[];
}) {
  const [form, setForm] = useState({ hasilPanen: pohon.hasilPanen, pemupukan: pohon.pemupukan, pengobatan: pohon.pengobatan, status: pohon.status });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // B2 riwayat form
  const [gejala, setGejala] = useState("");
  const [tindakan, setTindakan] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rLoading, setRLoading] = useState(false);
  const [rMsg, setRMsg] = useState<string | null>(null);
  const [tanggalCek, setTanggalCek] = useState("");

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  async function submitSnapshot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const token = localStorage.getItem("token") || "";
      const payload: any = {};
      if (form.hasilPanen !== pohon.hasilPanen) payload.hasilPanen = form.hasilPanen === "" ? null : Number(form.hasilPanen);
      if (form.pemupukan !== pohon.pemupukan) payload.pemupukan = form.pemupukan || null;
      if (form.pengobatan !== pohon.pengobatan) payload.pengobatan = form.pengobatan || null;
      if (form.status !== pohon.status) payload.status = form.status;
      if (Object.keys(payload).length === 0) throw new Error("Tidak ada perubahan snapshot");
      const res = await fetch(`/api/pohon/${pohon.id}/lapangan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Gagal update lapangan");
      setMsg("Snapshot lapangan berhasil diupdate");
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
      const formData = new FormData();
      formData.set("gejala", gejala);
      formData.set("tindakan", tindakan);
      if (tanggalCek) formData.set("tanggalCek", tanggalCek);
      if (file) formData.set("foto", file);

      let res: Response;
      if (file) {
        res = await fetch(`/api/pohon/${pohon.id}/riwayat`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      } else {
        res = await fetch(`/api/pohon/${pohon.id}/riwayat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ gejala, tindakan, tanggalCek: tanggalCek || undefined }),
        });
      }
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Gagal simpan riwayat");
      setRMsg("Riwayat berhasil ditambahkan");
      setGejala("");
      setTindakan("");
      setFile(null);
      setPreview(null);
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      setRMsg(e.message);
    } finally {
      setRLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* B1 Snapshot */}
      <Card className="border-emerald-100">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sprout className="h-4 w-4 text-emerald-700" /> Snapshot Lapangan Terbaru
          </CardTitle>
          <CardDescription>Hasil panen, pemupukan, pengobatan terakhir — tampil di tabel & publik</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitSnapshot} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hasilPanen">Hasil Panen (KG)</Label>
                <Input id="hasilPanen" type="number" step="0.1" value={form.hasilPanen} onChange={(e) => setForm({ ...form, hasilPanen: e.target.value })} placeholder="125.5" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="SEHAT">SEHAT</option>
                  <option value="PERLU_PERHATIAN">PERLU PERHATIAN</option>
                  <option value="SAKIT">SAKIT</option>
                  <option value="MATI">MATI</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pemupukan</Label>
              <Textarea value={form.pemupukan} onChange={(e) => setForm({ ...form, pemupukan: e.target.value })} placeholder="NPK 2kg - 2026-01-15" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Pengobatan</Label>
              <Textarea value={form.pengobatan} onChange={(e) => setForm({ ...form, pengobatan: e.target.value })} placeholder="Fungisida 2ml/L - Sehat" rows={2} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-emerald-700 hover:bg-emerald-800 h-11">
              {loading ? "Menyimpan..." : "Simpan Snapshot Lapangan"}
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

      {/* B2 Riwayat */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="h-4 w-4 text-slate-700" /> Tambah Riwayat Harian
          </CardTitle>
          <CardDescription>Gejala, tindakan, foto lapangan via kamera HP — historis</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitRiwayat} className="space-y-4">
            <div className="space-y-2">
              <Label>Tanggal Cek (opsional)</Label>
              <Input type="date" value={tanggalCek} onChange={(e) => setTanggalCek(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Gejala *</Label>
              <Textarea value={gejala} onChange={(e) => setGejala(e.target.value)} placeholder="Daun menguning, bercak coklat..." required minLength={5} />
            </div>
            <div className="space-y-2">
              <Label>Tindakan *</Label>
              <Textarea value={tindakan} onChange={(e) => setTindakan(e.target.value)} placeholder="Semprot fungisida 2ml/L..." required minLength={5} />
            </div>
            <div className="space-y-2">
              <Label>Foto Lapangan</Label>
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
                <Input type="file" accept="image/*" capture="environment" onChange={onFile} className="bg-white" />
                <p className="mt-1 text-xs text-slate-500">Maks 5MB • JPG/PNG/WEBP</p>
                {preview && <img src={preview} alt="preview" className="mt-3 h-48 w-full object-cover rounded-lg border" />}
              </div>
            </div>
            <Button type="submit" disabled={rLoading} className="w-full bg-slate-900 hover:bg-slate-800 h-11">
              {rLoading ? "Mengupload..." : <><Upload className="h-4 w-4" /> Simpan Riwayat</>}
            </Button>
            {rMsg && <div className="rounded-lg bg-slate-100 border p-3 text-sm text-slate-700">{rMsg}</div>}
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-slate-100">
        <CardHeader>
          <CardTitle className="text-sm">History 10 Terbaru</CardTitle>
          <CardDescription>{riwayat.length} entri untuk {pohon.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {riwayat.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-400">Belum ada riwayat</div>
          ) : (
            riwayat.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{new Date(r.tanggalCek).toLocaleDateString("id-ID")} • {r.petugasNama}</span>
                  {r.fotoUrl && (
                    <a href={r.fotoUrl} target="_blank" className="text-slate-900 font-medium hover:underline">
                      Foto →
                    </a>
                  )}
                </div>
                <div className="mt-2 text-sm font-medium text-slate-900">{r.gejala}</div>
                <div className="text-xs text-slate-500">→ {r.tindakan}</div>
                {r.fotoUrl && <img src={r.fotoUrl} alt="foto" className="mt-3 h-36 w-full object-cover rounded-xl" />}
              </div>
            ))
          )}
          <div className="flex gap-2">
            <Link href="/admin/pertanian/pohon" className="flex-1">
              <Button variant="outline" className="w-full rounded-full">Kembali ke Data Pohon</Button>
            </Link>
            <Link href="/admin/pertanian/riwayat" className="flex-1">
              <Button variant="outline" className="w-full rounded-full">Lihat Log Global</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
