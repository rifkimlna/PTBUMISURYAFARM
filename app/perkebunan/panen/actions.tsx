"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export function TambahPanenForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pohonId, setPohonId] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [kg, setKg] = useState("");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch("/api/panen", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ pohonId, tanggalPanen: tanggal, jumlahKg: kg, catatan: catatan || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || j.error || "Gagal simpan");
      setPohonId("");
      setKg("");
      setCatatan("");
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
        + Catat Panen
      </Button>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">Catat Panen</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>ID Pohon *</Label>
            <Input value={pohonId} onChange={(e) => setPohonId(e.target.value.toUpperCase())} placeholder="PHN-BLK-A01" required className="h-11 font-mono" />
          </div>
          <div className="space-y-2">
            <Label>Tanggal *</Label>
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Jumlah (KG) *</Label>
            <Input type="number" step="0.1" min="0.1" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="12.5" required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Opsional" className="h-11" />
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

export function HapusPanenButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function hapus() {
    if (!window.confirm("Hapus catatan panen ini?")) return;
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`/api/panen/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || j.error || "Gagal hapus");
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Gagal hapus");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={loading}
      onClick={hapus}
      title="Hapus"
      className="h-8 w-8 rounded-full cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
