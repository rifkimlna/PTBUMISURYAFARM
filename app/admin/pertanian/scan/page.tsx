"use client";
import { useState, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

function ScanForm() {
  const search = useSearchParams();
  const initialId = search.get("id");
  // Redirect ke halaman lapangan terpisah jika ada id
  if (initialId) {
    if (typeof window !== "undefined") {
      window.location.replace(`/admin/pertanian/pohon/${initialId}/lapangan`);
      return (
        <div className="text-sm text-slate-500">
          Mengalihkan ke Data Lapangan {initialId}...
        </div>
      );
    }
  }
  const [pohonId, setPohonId] = useState(initialId || "PHN-BLK-A01");
  const [status, setStatus] = useState("SEHAT");
  const [gejala, setGejala] = useState("");
  const [tindakan, setTindakan] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const token = localStorage.getItem("token") || "";
      const formData = new FormData();
      formData.set("gejala", gejala);
      formData.set("tindakan", tindakan);
      if (file) formData.set("foto", file);
      let res: Response;
      if (file) {
        res = await fetch(`/api/pohon/${pohonId}/riwayat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        res = await fetch(`/api/pohon/${pohonId}/riwayat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ gejala, tindakan }),
        });
      }
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Gagal");
      setMsg("Berhasil update • foto tersimpan di cloud → fotoUrl");
      setGejala("");
      setTindakan("");
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Camera className="h-4 w-4 text-green-800" /> Input Kesehatan Pohon
        </CardTitle>
        <CardDescription>ID custom • upload foto lapangan</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pohonId">ID Pohon</Label>
              <Input id="pohonId" value={pohonId} onChange={(e) => setPohonId(e.target.value)} placeholder="PHN-BLK-A01" required />
            </div>
            <div className="space-y-2">
              <Label>Status Kesehatan</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="SEHAT">SEHAT</option>
                <option value="PERLU_PERHATIAN">PERLU PERHATIAN</option>
                <option value="SAKIT">SAKIT</option>
                <option value="MATI">MATI</option>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Gejala</Label>
            <Textarea value={gejala} onChange={(e) => setGejala(e.target.value)} placeholder="Daun menguning, bercak coklat..." required minLength={5} />
          </div>
          <div className="space-y-2">
            <Label>Tindakan</Label>
            <Textarea value={tindakan} onChange={(e) => setTindakan(e.target.value)} placeholder="Semprot fungisida 2ml/L..." required minLength={5} />
          </div>
          <div className="space-y-2">
            <Label>Foto Lapangan (kamera HP)</Label>
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
              <Input type="file" accept="image/*" capture="environment" onChange={onFile} className="bg-white" />
              <p className="mt-1 text-xs text-slate-500">Maks 5MB • JPG/PNG/WEBP → upload ke Supabase/UploadThing</p>
              {preview && (
                <div className="mt-3">
                  <img src={preview} alt="preview" className="h-48 w-full object-cover rounded-lg border" />
                  <Badge variant="sehat" className="mt-2">
                    Siap upload → fotoUrl
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-800 h-12 text-base">
            {loading ? "Mengupload..." : <><Upload className="h-4 w-4" /> Simpan Riwayat</>}
          </Button>
          {msg && (
            <div className="rounded-lg bg-green-50 border border-green-300 p-3 text-sm text-green-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {msg}
            </div>
          )}
          <p className="text-xs text-slate-400">
            API: <code className="bg-slate-100 px-1 rounded">POST /api/pohon/[id]/riwayat</code> • Validasi Zod • Role SUPER_ADMIN/ADMIN_PERTANIAN
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ScanPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Form Update Lapangan</h1>
        <p className="text-sm text-slate-500">Mobile-friendly • foto lewat kamera HP → cloud → fotoUrl</p>
      </div>
      <Suspense fallback={<div className="text-sm text-slate-500">Memuat...</div>}>
        <ScanForm />
      </Suspense>
    </div>
  );
}
