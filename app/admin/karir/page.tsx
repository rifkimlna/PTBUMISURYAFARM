"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, FileText, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type Lowongan = {
  id: string;
  judul: string;
  divisi: string;
  lokasi: string;
  tipe: "KERJA" | "MAGANG";
  deskripsi: string;
  kualifikasi: string;
  deadline: string | null;
  isActive: boolean;
  _count?: { pelamar: number };
};

type Pelamar = {
  id: string;
  nama: string;
  email: string;
  wa: string;
  cvUrl: string;
  tipe: string;
  status: "BARU" | "SELEKSI" | "INTERVIEW" | "DITERIMA" | "DITOLAK";
  createdAt: string;
  lowongan: { judul: string; divisi: string };
};

const STATUS_LIST = ["BARU", "SELEKSI", "INTERVIEW", "DITERIMA", "DITOLAK"] as const;

const emptyForm = {
  judul: "",
  divisi: "",
  lokasi: "Kebun PT BST",
  tipe: "KERJA" as "KERJA" | "MAGANG",
  deskripsi: "",
  kualifikasi: "",
  deadline: "",
};

const statusColor: Record<string, string> = {
  BARU: "bg-slate-600 text-white",
  SELEKSI: "bg-blue-600 text-white",
  INTERVIEW: "bg-amber-500 text-white",
  DITERIMA: "bg-green-700 text-white",
  DITOLAK: "bg-red-600 text-white",
};

export default function AdminKarirPage() {
  const [view, setView] = useState<"LOWONGAN" | "PELAMAR">("LOWONGAN");
  const [lowongan, setLowongan] = useState<Lowongan[]>([]);
  const [pelamar, setPelamar] = useState<Pelamar[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadLowongan = async () => {
    const r = await fetch("/api/karir/lowongan");
    const j = await r.json();
    if (j?.success) setLowongan(j.data);
  };
  const loadPelamar = async () => {
    const r = await fetch("/api/karir/pelamar");
    const j = await r.json();
    if (j?.success) setPelamar(j.data);
  };
  useEffect(() => {
    loadLowongan();
    loadPelamar();
  }, []);

  const getToken = () => localStorage.getItem("token");

  const submitLowongan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/karir/lowongan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...form, deadline: form.deadline || null }),
      });
      const j = await r.json();
      if (j?.success) {
        setShowForm(false);
        setForm(emptyForm);
        loadLowongan();
      } else setError(j?.message || "Gagal menyimpan");
    } catch {
      setError("Gagal menyimpan");
    }
    setSaving(false);
  };

  const toggleActive = async (l: Lowongan) => {
    await fetch(`/api/karir/lowongan/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ isActive: !l.isActive }),
    });
    loadLowongan();
  };

  const hapusLowongan = async (id: string) => {
    if (!confirm("Hapus lowongan ini beserta semua pelamarnya?")) return;
    await fetch(`/api/karir/lowongan/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
    loadLowongan();
    loadPelamar();
  };

  const ubahStatus = async (id: string, status: string) => {
    await fetch(`/api/karir/pelamar/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ status }),
    });
    loadPelamar();
  };

  const hapusPelamar = async (id: string) => {
    if (!confirm("Hapus pelamar ini?")) return;
    await fetch(`/api/karir/pelamar/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
    loadPelamar();
  };

  const inputCls = "rounded-lg";

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Briefcase className="h-5 w-5" /> Karir
          </h1>
          <p className="text-sm text-slate-500">Kelola lowongan kerja & magang, dan pantau pelamar.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("LOWONGAN")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium cursor-pointer ${view === "LOWONGAN" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Lowongan ({lowongan.length})
          </button>
          <button
            onClick={() => setView("PELAMAR")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium cursor-pointer ${view === "PELAMAR" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Pelamar ({pelamar.length})
          </button>
        </div>
      </div>

      {view === "LOWONGAN" && (
        <div className="space-y-4">
          <Button onClick={() => setShowForm(!showForm)} className="bg-green-800 hover:bg-green-900 rounded-full cursor-pointer">
            <Plus className="h-4 w-4" /> Lowongan Baru
          </Button>

          {showForm && (
            <Card>
              <CardContent className="py-5">
                <form onSubmit={submitLowongan} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Judul posisi</Label>
                      <Input className={inputCls} value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} required placeholder="ex: Admin Gudang" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Divisi</Label>
                      <Input className={inputCls} value={form.divisi} onChange={(e) => setForm({ ...form, divisi: e.target.value })} required placeholder="ex: Operasional" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Lokasi</Label>
                      <Input className={inputCls} value={form.lokasi} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tipe</Label>
                      <select
                        value={form.tipe}
                        onChange={(e) => setForm({ ...form, tipe: e.target.value as "KERJA" | "MAGANG" })}
                        className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option value="KERJA">Pekerjaan</option>
                        <option value="MAGANG">Magang</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Deadline (opsional)</Label>
                      <Input className={inputCls} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deskripsi</Label>
                    <Textarea className={inputCls} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} required placeholder="Tanggung jawab singkat, satu per baris" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kualifikasi</Label>
                    <Textarea className={inputCls} value={form.kualifikasi} onChange={(e) => setForm({ ...form, kualifikasi: e.target.value })} required placeholder="Syarat, satu per baris" />
                  </div>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving} className="bg-green-800 hover:bg-green-900 rounded-full cursor-pointer">
                      {saving ? "Menyimpan" : "Simpan"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-full cursor-pointer">
                      Batal
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lowongan.map((l) => (
              <Card key={l.id} className="border-slate-200 flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 py-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{l.judul}</span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold text-white ${l.tipe === "KERJA" ? "bg-green-800" : "bg-amber-500"}`}>
                        {l.tipe === "KERJA" ? "PEKERJAAN" : "MAGANG"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">{l.divisi} • {l.lokasi}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold text-white ${l.isActive ? "bg-green-700" : "bg-slate-400"}`}>
                        {l.isActive ? "AKTIF" : "NONAKTIF"}
                      </span>
                      <span className="rounded-md bg-slate-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {l._count?.pelamar ?? 0} pelamar
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleActive(l)} className="rounded-full flex-1 cursor-pointer">
                      {l.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => hapusLowongan(l.id)} className="rounded-full text-red-600 hover:text-red-700 cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!lowongan.length && <p className="py-8 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-3">Belum ada lowongan.</p>}
          </div>
        </div>
      )}

      {view === "PELAMAR" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pelamar.map((p) => (
            <Card key={p.id} className="border-slate-200 flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 py-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{p.nama}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[p.status]}`}>{p.status}</span>
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-slate-700">{p.lowongan.judul}</p>
                  <p className="text-xs text-slate-500">{p.email}</p>
                  <p className="text-xs text-slate-500">{p.wa}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={p.cvUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" size="sm" className="rounded-full w-full cursor-pointer">
                      <FileText className="h-3.5 w-3.5" /> CV
                    </Button>
                  </a>
                  <select
                    value={p.status}
                    onChange={(e) => ubahStatus(p.id, e.target.value)}
                    className="h-8 flex-1 rounded-full border border-slate-200 bg-white px-2 text-xs cursor-pointer"
                  >
                    {STATUS_LIST.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <Button variant="outline" size="sm" onClick={() => hapusPelamar(p.id)} className="rounded-full text-red-600 hover:text-red-700 cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!pelamar.length && <p className="py-8 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-3">Belum ada pelamar.</p>}
        </div>
      )}
    </div>
  );
}
