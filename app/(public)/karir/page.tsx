"use client";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock, Briefcase, GraduationCap, Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
};

type Tab = "SEMUA" | "KERJA" | "MAGANG";

export default function KarirPage() {
  const [items, setItems] = useState<Lowongan[]>([]);
  const [tab, setTab] = useState<Tab>("SEMUA");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const [formFor, setFormFor] = useState<Lowongan | null>(null);
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [wa, setWa] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/karir/lowongan");
      const j = await r.json();
      if (j?.success) setItems(j.data);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (tab === "SEMUA" || i.tipe === tab) &&
          (!q ||
            i.judul.toLowerCase().includes(q.toLowerCase()) ||
            i.divisi.toLowerCase().includes(q.toLowerCase()))
      ),
    [items, tab, q]
  );

  const openForm = (l: Lowongan) => {
    setSent(false);
    setError("");
    setFormFor(l);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFor) return;
    setSending(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("lowonganId", formFor.id);
      fd.append("nama", nama);
      fd.append("email", email);
      fd.append("wa", wa);
      if (cv) fd.append("cv", cv);
      const r = await fetch("/api/karir/lamar", { method: "POST", body: fd });
      const j = await r.json();
      if (j?.success) {
        setSent(true);
      } else {
        setError(j?.message || "Gagal mengirim lamaran");
      }
    } catch {
      setError("Gagal mengirim lamaran");
    }
    setSending(false);
  };

  const fmtDeadline = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-green-800 text-white">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">Karir di Bumi Surya Farm</h1>
          <p className="mt-3 max-w-xl text-sm sm:text-base text-white/70">
            Tumbuh bersama kami di perkebunan berstandar GAP dan organik.
          </p>
        </div>
      </section>

      {/* Filter + list */}
      <section className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {(["SEMUA", "KERJA", "MAGANG"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  tab === t ? "bg-green-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t === "SEMUA" ? "Semua" : t === "KERJA" ? "Pekerjaan" : "Magang"}
              </button>
            ))}
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari posisi atau divisi"
            className="sm:max-w-xs rounded-full"
          />
        </div>

        <p className="mt-6 text-xs text-slate-500">{filtered.length} lowongan tersedia</p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="text-sm text-slate-500 py-8 text-center sm:col-span-2 lg:col-span-3">Memuat lowongan</p>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                Belum ada lowongan yang cocok. Coba filter lain.
              </CardContent>
            </Card>
          ) : (
            filtered.map((l) => (
              <Card key={l.id} className="border-slate-200 flex flex-col min-h-[260px]">
                <CardContent className="flex flex-1 flex-col gap-4 py-5">
                  <span
                    className={`self-start rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide text-white ${
                      l.tipe === "KERJA" ? "bg-green-800" : "bg-amber-500"
                    }`}
                  >
                    {l.tipe === "KERJA" ? "PEKERJAAN" : "MAGANG"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900">{l.judul}</h3>
                    <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><Briefcase className="h-3 w-3" /> {l.divisi}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {l.lokasi}</span>
                      {fmtDeadline(l.deadline) && (
                        <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Tutup {fmtDeadline(l.deadline)}</span>
                      )}
                    </div>
                  </div>
                  <Button onClick={() => openForm(l)} className="bg-green-800 hover:bg-green-900 rounded-full w-full cursor-pointer">
                    Lamar
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Form lamaran */}
      {formFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setFormFor(null)}>
          <div
            className="w-full sm:max-w-lg max-h-[90dvh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-6 w-6 text-green-800" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">Lamaran terkirim</h3>
                <p className="mt-1 text-sm text-slate-500">Kami akan menghubungi Anda via WhatsApp atau email.</p>
                <Button onClick={() => setFormFor(null)} variant="outline" className="mt-6 rounded-full cursor-pointer">
                  Tutup
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Lamar: {formFor.judul}</h3>
                  <p className="text-xs text-slate-500">{formFor.divisi} • {formFor.lokasi}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="karir-nama">Nama lengkap</Label>
                  <Input id="karir-nama" value={nama} onChange={(e) => setNama(e.target.value)} required placeholder="Nama Anda" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="karir-email">Email</Label>
                    <Input id="karir-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="nama@email.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="karir-wa">No. WhatsApp</Label>
                    <Input id="karir-wa" value={wa} onChange={(e) => setWa(e.target.value)} required placeholder="08xxxxxxxxxx" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="karir-cv">CV (PDF, maks 5MB)</Label>
                  <label
                    htmlFor="karir-cv"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-green-700 hover:text-green-800"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span className="truncate">{cv ? cv.name : "Pilih file CV"}</span>
                  </label>
                  <input
                    id="karir-cv"
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => setCv(e.target.files?.[0] || null)}
                    required
                  />
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setFormFor(null)} className="rounded-full flex-1 cursor-pointer">
                    Batal
                  </Button>
                  <Button type="submit" disabled={sending} className="rounded-full flex-1 bg-green-800 hover:bg-green-900 cursor-pointer">
                    <GraduationCap className="h-4 w-4" /> {sending ? "Mengirim" : "Kirim Lamaran"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
