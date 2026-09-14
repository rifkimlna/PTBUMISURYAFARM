"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Trash2 } from "lucide-react";

function authHeader(isJson = false) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const h: Record<string, string> = {};
  if (isJson) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function TambahJadwalForm({ bloks }: { bloks: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [blok, setBlok] = useState(bloks[0] || "");
  const [pohonId, setPohonId] = useState("");
  const [jenis, setJenis] = useState("PUPUK");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/jadwal", {
        method: "POST",
        headers: authHeader(true),
        body: JSON.stringify({ blok, pohonId: pohonId || undefined, jenis, tanggalRencana: tanggal, catatan: catatan || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || j.error || "Gagal simpan");
      setPohonId("");
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
      <Button onClick={() => setOpen(true)} className="rounded-full bg-green-700 hover:bg-green-800 w-full sm:w-auto">
        + Buat Jadwal
      </Button>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">Jadwal Baru</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Blok *</Label>
            <select value={blok} onChange={(e) => setBlok(e.target.value)} required className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
              {bloks.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Jenis *</Label>
            <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="PUPUK">Pupuk</option>
              <option value="OBAT">Obat</option>
              <option value="LAIN">Lain</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>ID Pohon (opsional)</Label>
            <Input value={pohonId} onChange={(e) => setPohonId(e.target.value.toUpperCase())} placeholder="PHN-BLK-A01" className="h-11 font-mono" />
          </div>
          <div className="space-y-2">
            <Label>Tanggal *</Label>
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required className="h-11" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Catatan</Label>
            <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="NPK 2kg per pohon" className="h-11" />
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

export function JadwalRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(s: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/jadwal/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: authHeader(true),
        body: JSON.stringify({ status: s }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || j.error || "Gagal update");
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Gagal update");
    } finally {
      setLoading(false);
    }
  }

  async function hapus() {
    if (!window.confirm("Hapus jadwal ini?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/jadwal/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeader() });
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
    <div className="flex items-center gap-1 shrink-0">
      {status === "RENCANA" && (
        <>
          <Button variant="ghost" size="sm" disabled={loading} onClick={() => setStatus("SELESAI")} title="Tandai selesai" className="h-8 w-8 rounded-full cursor-pointer text-green-700 hover:text-green-800 hover:bg-green-50">
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" disabled={loading} onClick={() => setStatus("BATAL")} title="Batalkan" className="h-8 w-8 rounded-full cursor-pointer text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
      <Button variant="ghost" size="sm" disabled={loading} onClick={hapus} title="Hapus" className="h-8 w-8 rounded-full cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
