"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Plus, ArrowLeft, MapPin, Camera, Crosshair } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [accuracy, setAccuracy] = useState<string>("");
  const [source, setSource] = useState("GPS");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
        const acc = Math.round(pos.coords.accuracy);
        setLatitude(lat);
        setLongitude(lng);
        setAccuracy(String(acc));
        setForm((s) => ({ ...s, koordinat: `${lat}, ${lng}` }));
        setSource("GPS");
        setGpsMsg(`GPS lock: ${lat}, ${lng} ±${acc}m`);
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

  const latNum = latitude ? Number(latitude) : null;
  const lngNum = longitude ? Number(longitude) : null;
  const accNum = accuracy ? Number(accuracy) : null;
  const accColor = accNum == null ? "text-slate-400" : accNum <= 30 ? "text-green-700" : accNum <= 50 ? "text-amber-600" : "text-red-600";
  const accBadge = accNum == null ? "" : accNum <= 30 ? " (Akurat)" : accNum <= 50 ? " (Sedang)" : " (>50m - perlu di area terbuka)";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      if (!foto) throw new Error("Foto geotag wajib — upload foto pohon");
      if (!latitude || !longitude) throw new Error("Koordinat GPS wajib — klik Ambil GPS atau isi manual lat/lng");
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const fd = new FormData();
      fd.set("id", form.id.toUpperCase());
      if (form.namaPohon) fd.set("namaPohon", form.namaPohon);
      fd.set("varietas", form.varietas);
      if (form.jenis) fd.set("jenis", form.jenis);
      fd.set("lokasiBlok", form.lokasiBlok);
      fd.set("tanggalTanam", form.tanggalTanam);
      fd.set("koordinat", form.koordinat || `${latitude}, ${longitude}`);
      if (form.hasilPanen) fd.set("hasilPanen", form.hasilPanen);
      if (form.pemupukan) fd.set("pemupukan", form.pemupukan);
      if (form.pengobatan) fd.set("pengobatan", form.pengobatan);
      fd.set("status", form.status);
      fd.set("foto", foto);
      fd.set("latitude", latitude);
      fd.set("longitude", longitude);
      if (accuracy) fd.set("accuracy", accuracy);
      fd.set("source", source);
      fd.set("geotagTimestamp", new Date().toISOString());

      const res = await fetch("/api/pohon", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || j.error || "Gagal tambah pohon");
      setMsg(`Berhasil: ${j.data?.id || form.id} + foto geotag tersimpan`);
      setTimeout(() => router.push("/perkebunan/pohon"), 1200);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const koordinatToMap = latitude && longitude ? `${latitude},${longitude}` : form.koordinat ? form.koordinat.replace(/\s/g, "") : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 min-w-0 px-0">
      <div className="flex items-start sm:items-center gap-3">
        <Link href="/perkebunan/pohon" className="shrink-0">
          <Button variant="ghost" size="icon" className="rounded-full cursor-pointer shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Tambah Data Pohon — Wajib Geotag</h1>
          <p className="text-xs sm:text-sm text-slate-500">11 field + Foto Geotag terbaru (GPS/EXIF/MANUAL) wajib setiap pohon</p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-green-700" /> Form 11 Field + Geotag Wajib
          </CardTitle>
          <CardDescription>ID PHN-* • Foto + GPS wajib • Akurasi ≤50m ideal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="id">ID Pohon *</Label>
                <Input id="id" value={form.id} onChange={(e) => onChange("id", e.target.value)} placeholder="PHN-BLK-A03" required pattern="PHN-[A-Z0-9-]+" title="Format PHN-*" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="namaPohon">2. NAMA POHON</Label>
                <Input id="namaPohon" value={form.namaPohon} onChange={(e) => onChange("namaPohon", e.target.value)} placeholder="Pohon Sawit 003" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="varietas">Varietas *</Label>
                <Input id="varietas" value={form.varietas} onChange={(e) => onChange("varietas", e.target.value)} placeholder="Sawit DxP" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jenis">3. JENIS</Label>
                <Input id="jenis" value={form.jenis} onChange={(e) => onChange("jenis", e.target.value)} placeholder="Sawit / Durian / Karet" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lokasiBlok">6. BLOK *</Label>
                <Input id="lokasiBlok" value={form.lokasiBlok} onChange={(e) => onChange("lokasiBlok", e.target.value)} placeholder="Blok A" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tanggalTanam">5. TANGGAL TANAM *</Label>
                <Input id="tanggalTanam" type="date" value={form.tanggalTanam} onChange={(e) => onChange("tanggalTanam", e.target.value)} required />
              </div>
            </div>

            {/* Geotag wajib */}
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <Camera className="h-4 w-4" /> Foto Geotag Wajib * <span className="text-xs font-normal text-emerald-700">— 1 foto terbaru per pohon</span>
              </div>

              <div className="space-y-2">
                <Label>Foto Pohon (kamera HP) *</Label>
                <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-white p-3">
                  <Input type="file" accept="image/*" capture="environment" onChange={onFile} required className="bg-white" />
                  <p className="mt-1 text-xs text-slate-500">Maks 5MB • JPG/PNG/WEBP — akan diupload ke Supabase folder pohon-geotag</p>
                  {preview && <img src={preview} alt="preview" className="mt-3 h-56 w-full object-cover rounded-lg border" />}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Latitude *</Label>
                  <Input value={latitude} onChange={(e) => { setLatitude(e.target.value); setForm((s) => ({ ...s, koordinat: `${e.target.value}, ${longitude}` })); }} placeholder="-2.983" required />
                </div>
                <div className="space-y-2">
                  <Label>Longitude *</Label>
                  <Input value={longitude} onChange={(e) => { setLongitude(e.target.value); setForm((s) => ({ ...s, koordinat: `${latitude}, ${e.target.value}` })); }} placeholder="104.752" required />
                </div>
                <div className="space-y-2">
                  <Label>Akurasi (m)</Label>
                  <Input value={accuracy} onChange={(e) => setAccuracy(e.target.value)} placeholder="12" type="number" />
                  {accuracy && <p className={`text-xs ${accColor}`}>{accuracy}m{accBadge}</p>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="koordinat">7. KOORDINAT (auto)</Label>
                  <Input id="koordinat" value={form.koordinat} onChange={(e) => onChange("koordinat", e.target.value)} placeholder="-2.983, 104.752" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Preview Peta
                  </Label>
                  {koordinatToMap ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <iframe
                        title="map"
                        width="100%"
                        height="180"
                        style={{ border: 0 }}
                        loading="lazy"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(koordinatToMap)}&z=16&output=embed`}
                      />
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(koordinatToMap)}`} target="_blank" className="block bg-slate-50 px-3 py-1.5 text-xs text-emerald-700 hover:underline text-center">
                        Buka di Google Maps →
                      </a>
                    </div>
                  ) : (
                    <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">Isi lat/lng atau Ambil GPS untuk preview</div>
                  )}
                </div>
              </div>
              <p className="text-xs text-emerald-800/70">Wajib: foto + lat/lng. Akurasi ≤30m hijau, 30-50m kuning, &gt;50m merah — coba di area terbuka.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hasilPanen">8. HASIL PANEN (KG)</Label>
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
              <Label htmlFor="pemupukan">10. PEMUPUKAN</Label>
              <Textarea id="pemupukan" value={form.pemupukan} onChange={(e) => onChange("pemupukan", e.target.value)} placeholder="NPK 2kg - 2026-01-15" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pengobatan">11. PENGOBATAN</Label>
              <Textarea id="pengobatan" value={form.pengobatan} onChange={(e) => onChange("pengobatan", e.target.value)} placeholder="Fungisida 2ml/L - Sehat" rows={2} />
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500">
              <div>1. NO = auto • 4. RIWAYAT = via Data Lapangan • 9. USIA = auto • Foto Geotag wajib overwrite terbaru</div>
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-800 h-12 text-base">
              {loading ? "Mengupload & Menyimpan..." : "Simpan Data Pohon + Geotag"}
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
    </div>
  );
}
