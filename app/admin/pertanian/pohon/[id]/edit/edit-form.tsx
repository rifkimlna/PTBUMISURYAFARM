"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CheckCircle2, ArrowLeft, Pencil } from "lucide-react";
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
  };
};

export function EditMasterForm({ pohon }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(pohon);
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
      const payload: any = {};
      if (form.namaPohon !== pohon.namaPohon) payload.namaPohon = form.namaPohon || null;
      if (form.varietas !== pohon.varietas) payload.varietas = form.varietas;
      if (form.jenis !== pohon.jenis) payload.jenis = form.jenis || null;
      if (form.lokasiBlok !== pohon.lokasiBlok) payload.lokasiBlok = form.lokasiBlok;
      if (form.tanggalTanam !== pohon.tanggalTanam) payload.tanggalTanam = form.tanggalTanam;
      if (form.koordinat !== pohon.koordinat) payload.koordinat = form.koordinat || null;
      if (form.status !== pohon.status) payload.status = form.status;
      if (Object.keys(payload).length === 0) throw new Error("Tidak ada perubahan");

      const res = await fetch(`/api/pohon/${pohon.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || j.error || "Gagal update master");
      setMsg("Berhasil update master");
      setTimeout(() => router.push("/admin/pertanian/pohon"), 1000);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Pencil className="h-4 w-4 text-slate-700" /> Edit Master — {pohon.id}
        </CardTitle>
        <CardDescription>ID tidak bisa diubah • NAMA/JENIS/BLOK/TANGGAL/KOORDINAT/STATUS</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>ID Pohon (read-only)</Label>
            <Input value={pohon.id} disabled className="font-mono bg-slate-50" />
          </div>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>JENIS</Label>
              <Input value={form.jenis} onChange={(e) => onChange("jenis", e.target.value)} placeholder="Sawit / Durian" />
            </div>
            <div className="space-y-2">
              <Label>BLOK *</Label>
              <Input value={form.lokasiBlok} onChange={(e) => onChange("lokasiBlok", e.target.value)} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>TANGGAL TANAM *</Label>
              <Input type="date" value={form.tanggalTanam} onChange={(e) => onChange("tanggalTanam", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>KOORDINAT</Label>
              <Input value={form.koordinat} onChange={(e) => onChange("koordinat", e.target.value)} placeholder="-2.983, 104.752" />
            </div>
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
          <div className="flex gap-2">
            <Link href="/admin/pertanian/pohon" className="flex-1">
              <Button type="button" variant="outline" className="w-full rounded-full">
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Button>
            </Link>
            <Button type="submit" disabled={loading} className="flex-1 bg-slate-900 hover:bg-slate-800 rounded-full">
              {loading ? "Menyimpan..." : "Simpan Master"}
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
  );
}
