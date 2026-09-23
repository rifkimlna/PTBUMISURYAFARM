"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Plus, ArrowLeft, Camera, Crosshair, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { stampGeotagPhoto } from "@/lib/geotag-stamp";

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
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [source, setSource] = useState("GPS");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [blokList, setBlokList] = useState<string[]>(["Blok A", "Blok B", "Blok C", "Blok D"]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    fetch("/api/blok", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const rows = j?.data;
        if (Array.isArray(rows) && rows.length > 0) setBlokList(rows.map((b: { nama: string }) => b.nama));
      })
      .catch(() => {});
  }, []);

  const onChange = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFoto(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const ambilGPS = () => {
    if (!navigator.geolocation) {
      setGpsMsg("GPS tidak didukung browser ini, pakai input manual");
      setSource("MANUAL");
      return;
    }
    setGpsLoading(true);
    setGpsMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setForm((s) => ({ ...s, koordinat: `${lat}, ${lng}` }));
        setSource("GPS");
        setGpsMsg(`GPS lock: ${lat}, ${lng}`);
        setGpsLoading(false);
      },
      (err) => {
        setGpsMsg(`Gagal GPS: ${err.message} — pakai manual`);
        setSource("MANUAL");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  function parseKoordinat(text: string): { lat: number; lng: number } | null {
    if (!text) return null;
    const parts = text.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (parts[0] >= -90 && parts[0] <= 90 && parts[1] >= -180 && parts[1] <= 180) {
        return { lat: parts[0], lng: parts[1] };
      }
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      if (!foto) throw new Error("Foto geotag wajib — upload foto pohon");
      const parsed = parseKoordinat(form.koordinat);
      if (!parsed) throw new Error("Koordinat tidak valid — format: -2.983, 104.752");
      setMsg("Menyiapkan foto...");
      const stamped = await stampGeotagPhoto(foto, {
        pohonId: form.id.toUpperCase(),
        latitude: parsed.lat,
        longitude: parsed.lng,
        source,
      });
      setPreview(URL.createObjectURL(stamped));
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const fd = new FormData();
      fd.set("id", form.id.toUpperCase());
      if (form.namaPohon) fd.set("namaPohon", form.namaPohon);
      fd.set("varietas", form.varietas);
      if (form.jenis) fd.set("jenis", form.jenis);
      fd.set("lokasiBlok", form.lokasiBlok);
      fd.set("tanggalTanam", form.tanggalTanam);
      fd.set("koordinat", form.koordinat);
      fd.set("latitude", String(parsed.lat));
      fd.set("longitude", String(parsed.lng));
      if (form.hasilPanen) fd.set("hasilPanen", form.hasilPanen);
      if (form.pemupukan) fd.set("pemupukan", form.pemupukan);
      if (form.pengobatan) fd.set("pengobatan", form.pengobatan);
      fd.set("status", form.status);
      fd.set("foto", stamped);
      fd.set("source", source);
      fd.set("geotagTimestamp", new Date().toISOString());

      const res = await fetch("/api/pohon", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || j.error || "Gagal tambah pohon");
      setMsg(`Tersimpan: ${j.data?.id || form.id}`);
      setTimeout(() => router.push("/perkebunan/pohon"), 1200);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 min-w-0 px-0">
      <div className="flex items-start sm:items-center gap-3">
        <Link href="/perkebunan/pohon" className="shrink-0">
          <Button variant="ghost" size="icon" className="rounded-full cursor-pointer shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Tambah Pohon</h1>
          <p className="text-xs sm:text-sm text-slate-500">Data pohon + foto lokasi</p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-green-700" /> Data Pohon
          </CardTitle>
          <CardDescription>ID unik PHN-* • Foto + lokasi wajib diisi</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            <div>
              <div className="text-xs font-semibold tracking-widest text-slate-500 mb-3">IDENTITAS</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="id">ID Pohon *</Label>
                <Input id="id" value={form.id} onChange={(e) => onChange("id", e.target.value)} placeholder="PHN-BLK-A03" required pattern="PHN-[A-Z0-9-]+" title="Format PHN-*" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="namaPohon">Nama Pohon</Label>
                <Input id="namaPohon" value={form.namaPohon} onChange={(e) => onChange("namaPohon", e.target.value)} placeholder="Pohon Sawit 003" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div className="space-y-2">
                <Label htmlFor="varietas">Varietas *</Label>
                <Input id="varietas" value={form.varietas} onChange={(e) => onChange("varietas", e.target.value)} placeholder="Sawit DxP" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jenis">Jenis</Label>
                <Input id="jenis" value={form.jenis} onChange={(e) => onChange("jenis", e.target.value)} placeholder="Sawit / Durian / Karet" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div className="space-y-2">
                <Label htmlFor="lokasiBlok">Blok *</Label>
                <Select value={form.lokasiBlok} onChange={(e) => onChange("lokasiBlok", e.target.value)} required>
                  <option value="">Pilih blok</option>
                  {blokList.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tanggalTanam">Tanggal Tanam *</Label>
                <Input id="tanggalTanam" type="date" value={form.tanggalTanam} onChange={(e) => onChange("tanggalTanam", e.target.value)} required />
              </div>
            </div>
            </div>

            {/* Foto + lokasi */}
            <div className="border-t border-slate-100 pt-6">
              <div className="text-xs font-semibold tracking-widest text-slate-500 mb-3">FOTO & LOKASI</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Camera className="h-4 w-4" /> Foto Pohon *
              </div>

              <div className="space-y-2">
                <Label>Foto Pohon (kamera HP) *</Label>
                <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-white p-3">
                  <Input type="file" accept="image/*" capture="environment" onChange={onFile} required className="bg-white" />
                  <p className="mt-1 text-xs text-slate-500">Maks 5MB • JPG/PNG/WEBP</p>
                  {preview && <img src={preview} alt="preview" className="mt-3 h-56 w-full object-cover rounded-lg border" />}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Koordinat *</Label>
                <Input value={form.koordinat} onChange={(e) => onChange("koordinat", e.target.value)} placeholder="-2.983, 104.752" required />
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Button type="button" variant="outline" onClick={ambilGPS} disabled={gpsLoading} className="rounded-full border-emerald-200 hover:bg-emerald-50">
                  <Crosshair className="h-4 w-4" /> {gpsLoading ? "Mengambil GPS..." : "Ambil GPS Saat Ini"}
                </Button>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Source:</span>
                  <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-full border border-slate-200 px-3 py-1 text-xs bg-white">
                    <option value="GPS">GPS</option>
                    <option value="EXIF">EXIF</option>
                    <option value="MANUAL">MANUAL</option>
                  </select>
                </div>
                {gpsMsg && <span className="text-xs text-emerald-700">{gpsMsg}</span>}
              </div>

              {form.koordinat && parseKoordinat(form.koordinat) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Preview Peta
                    </Label>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <iframe
                        title="map"
                        width="100%"
                        height="180"
                        style={{ border: 0 }}
                        loading="lazy"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(form.koordinat)}&z=16&output=embed`}
                      />
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(form.koordinat)}`} target="_blank" className="block bg-slate-50 px-3 py-1.5 text-xs text-emerald-700 hover:underline text-center">
                        Buka di Google Maps →
                      </a>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500">Format: lat, lng (contoh: -2.983, 104.752). Foto + titik lokasi wajib diisi.</p>
            </div>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-widest text-slate-500 mb-3">HASIL & PERAWATAN</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hasilPanen">Hasil Panen (KG)</Label>
                <Input id="hasilPanen" type="number" step="0.1" min="0" value={form.hasilPanen} onChange={(e) => onChange("hasilPanen", e.target.value)} placeholder="125.5" />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="pemupukan">Pemupukan</Label>
              <Textarea id="pemupukan" value={form.pemupukan} onChange={(e) => onChange("pemupukan", e.target.value)} placeholder="NPK 2kg - 2026-01-15" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pengobatan">Pengobatan</Label>
              <Textarea id="pengobatan" value={form.pengobatan} onChange={(e) => onChange("pengobatan", e.target.value)} placeholder="Fungisida 2ml/L - Sehat" rows={2} />
            </div>

            <div className="sticky bottom-0 -mx-1 px-1 pb-1 pt-2 bg-white">
            <Button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-800 h-11 text-sm rounded-full cursor-pointer">
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
            </div>
            {msg && (
              <div className="rounded-lg bg-green-50 border border-green-300 p-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {msg}
              </div>
            )}
            {err && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
