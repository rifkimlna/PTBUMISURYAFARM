"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Pencil } from "lucide-react";

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function TambahBlokForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [luas, setLuas] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/blok", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ kode, nama, luasHa: luas || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || j.error || "Gagal simpan");
      setKode("");
      setNama("");
      setLuas("");
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
        + Tambah Blok
      </Button>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">Tambah Blok</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Kode *</Label>
            <Input value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())} placeholder="E" required className="h-11 font-mono" />
          </div>
          <div className="space-y-2">
            <Label>Nama *</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Blok E" required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Luas (Ha)</Label>
            <Input type="number" step="0.1" min="0" value={luas} onChange={(e) => setLuas(e.target.value)} placeholder="30" className="h-11" />
          </div>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 rounded-full h-11">Batal</Button>
            <Button type="submit" disabled={loading} className="flex-1 rounded-full h-11 bg-green-700 hover:bg-green-800">
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
          {err && <div className="sm:col-span-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}
        </form>
      </CardContent>
    </Card>
  );
}

export function BlokRowActions({ id, nama, luasHa, jumlahPohon }: { id: string; nama: string; luasHa: number | null; jumlahPohon: number }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [luas, setLuas] = useState(luasHa != null ? String(luasHa) : "");
  const [loading, setLoading] = useState(false);

  async function simpan() {
    setLoading(true);
    try {
      const res = await fetch(`/api/blok/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ luasHa: luas === "" ? null : Number(luas) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || j.error || "Gagal simpan");
      setEdit(false);
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setLoading(false);
    }
  }

  async function hapus() {
    if (jumlahPohon > 0) {
      alert(`Blok dipakai ${jumlahPohon} pohon, tidak bisa dihapus.`);
      return;
    }
    if (!window.confirm(`Hapus ${nama}?`)) return;
    try {
      const res = await fetch(`/api/blok/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeader() });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || j.error || "Gagal hapus");
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Gagal hapus");
    }
  }

  if (edit) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <Input
          type="number"
          step="0.1"
          min="0"
          value={luas}
          onChange={(e) => setLuas(e.target.value)}
          placeholder="Ha"
          className="h-9 w-20"
        />
        <Button size="sm" onClick={simpan} disabled={loading} className="h-9 rounded-full bg-green-700 hover:bg-green-800 px-3 text-xs">
          Simpan
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEdit(false)} className="h-9 rounded-full text-xs">
          Batal
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="ghost" size="sm" onClick={() => setEdit(true)} title="Ubah luas" className="h-8 w-8 rounded-full cursor-pointer">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" onClick={hapus} title="Hapus" className="h-8 w-8 rounded-full cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
