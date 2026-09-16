"use client";
import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Save, Camera, Sparkles } from "lucide-react";

export function PetugasLapanganMinimal({
  pohon,
  panenTerakhir,
  riwayatPanen,
}: {
  pohon: { id: string; pemupukan: string; pengobatan: string; status: string };
  panenTerakhir: { kg: string; tanggal: string; petugas: string } | null;
  riwayatPanen: { id: string; kg: string; tanggal: string; petugas: string }[];
}) {
  // Input panen = kejadian kali ini, mulai dari kosong (0) tiap buka form
  const [form, setForm] = useState({
    hasilPanen: "",
    status: pohon.status,
    pemupukan: pohon.pemupukan,
    pengobatan: pohon.pengobatan,
  });
  const [gejala, setGejala] = useState("");
  const [tindakan, setTindakan] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  };

  const triggerFile = () => fileRef.current?.click();

  const hasChange =
    form.hasilPanen.trim() !== "" ||
    form.pemupukan !== pohon.pemupukan ||
    form.pengobatan !== pohon.pengobatan ||
    form.status !== pohon.status ||
    gejala.trim().length >= 5 ||
    tindakan.trim().length >= 5 ||
    !!file;

  function fmtTanggal(iso: string) {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChange) {
      setErr("Ubah salah satu data dulu — hasil, status, pupuk, obat, atau gejala");
      return;
    }
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const token = localStorage.getItem("token") || "";
      // 1. Snapshot jika ada perubahan status/pupuk/obat + panen kali ini (kosong = tidak panen)
      const payload: any = {};
      const panenInput = form.hasilPanen.trim();
      if (panenInput !== "") {
        const n = Number(panenInput);
        if (!Number.isFinite(n) || n < 0) throw new Error("Hasil panen harus angka ≥ 0");
        payload.hasilPanen = n;
      }
      if (form.pemupukan !== pohon.pemupukan) payload.pemupukan = form.pemupukan || null;
      if (form.pengobatan !== pohon.pengobatan) payload.pengobatan = form.pengobatan || null;
      if (form.status !== pohon.status) payload.status = form.status;

      if (Object.keys(payload).length > 0) {
        const res = await fetch(`/api/pohon/${pohon.id}/lapangan`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.message || "Gagal simpan lapangan");
      }

      // 2. Riwayat jika gejala/tindakan + foto
      if (gejala.trim() || tindakan.trim() || file) {
        if (!gejala.trim() || gejala.trim().length < 5) throw new Error("Gejala minimal 5 huruf");
        if (!tindakan.trim() || tindakan.trim().length < 5) throw new Error("Tindakan minimal 5 huruf");
        const fd = new FormData();
        fd.set("gejala", gejala.trim());
        fd.set("tindakan", tindakan.trim());
        if (file) fd.set("foto", file);
        const res2 = await fetch(`/api/pohon/${pohon.id}/riwayat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const j2 = await res2.json();
        if (!res2.ok) throw new Error(j2.message || "Gagal simpan riwayat");
      }

      setMsg("Tersimpan — data global terupdate, admin ikut lihat");
      // reset input panen ke 0 lagi + gejala, keep perawatan/status
      setForm((f) => ({ ...f, hasilPanen: "" }));
      setGejala("");
      setTindakan("");
      setFile(null);
      setPreview(null);
      // small reload to refresh history
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Hidden input foto - jangan pakai display:none di iOS Safari, pakai sr-only agar fileRef.click() jalan */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        tabIndex={-1}
        className="sr-only"
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
      />

      {/* Hasil Panen - FOKUS UPDATE DATA DI ATAS */}
      <Card className="border-emerald-100 bg-emerald-50/30 overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-slate-900">Hasil Panen</div>
              <div className="text-xs text-slate-500">
                {panenTerakhir
                  ? <>Terakhir: <span className="font-semibold text-emerald-700">{Number(panenTerakhir.kg).toLocaleString("id-ID")} KG</span> • {fmtTanggal(panenTerakhir.tanggal)}</>
                  : "Belum pernah panen"}
              </div>
            </div>
          </div>
          <div className="relative">
            <Input
              id="hasilPanen"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              value={form.hasilPanen}
              onChange={(e) => setForm({ ...form, hasilPanen: e.target.value })}
              placeholder="0.0"
              className="h-14 sm:h-16 text-2xl sm:text-3xl font-semibold tracking-tight pr-16 bg-white border-emerald-200 focus-visible:ring-emerald-600 text-slate-900"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">KG</span>
          </div>
          <p className="text-xs text-slate-500">Isi panen <span className="font-medium">kali ini</span> — kosongkan jika tidak panen. Tercatat + tanggal otomatis.</p>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Status Pohon</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-11 bg-white text-sm">
              <option value="SEHAT">SEHAT</option>
              <option value="PERLU_PERHATIAN">PERLU PERHATIAN</option>
              <option value="SAKIT">SAKIT</option>
              <option value="MATI">MATI</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Riwayat Panen - history sudah panen + tanggal */}
      <Card className="border-slate-200">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold tracking-tight text-slate-900">Riwayat Panen</div>
            <div className="text-xs text-slate-400">{riwayatPanen.length} kali</div>
          </div>
          {riwayatPanen.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              Belum ada panen tercatat untuk pohon ini
            </div>
          ) : (
            <div className="space-y-2">
              {riwayatPanen.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500">{fmtTanggal(r.tanggal)} • {r.petugas}</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-700 whitespace-nowrap">
                    {Number(r.kg).toLocaleString("id-ID")} KG
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Perawatan - FOKUS UPDATE DATA */}
      <Card className="border-slate-200">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="text-sm font-semibold tracking-tight text-slate-900">Perawatan</div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-600">Pemupukan</Label>
              <Textarea
                value={form.pemupukan}
                onChange={(e) => setForm({ ...form, pemupukan: e.target.value })}
                placeholder="NPK 2kg - hari ini"
                rows={2}
                className="text-sm bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-600">Pengobatan</Label>
              <Textarea
                value={form.pengobatan}
                onChange={(e) => setForm({ ...form, pengobatan: e.target.value })}
                placeholder="Fungisida 2ml/L - kondisi sehat"
                rows={2}
                className="text-sm bg-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Catatan lapangan - minimal */}
      <Card className="border-slate-200">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="text-sm font-semibold tracking-tight text-slate-900">Catatan Lapangan (opsional)</div>
          <p className="text-xs text-slate-500">Isi jika ada gejala — langsung jadi riwayat global</p>
          <div className="space-y-3">
            <Textarea value={gejala} onChange={(e) => setGejala(e.target.value)} placeholder="Gejala: daun menguning..." rows={2} className="text-sm" />
            <Textarea value={tindakan} onChange={(e) => setTindakan(e.target.value)} placeholder="Tindakan: semprot..." rows={2} className="text-sm" />
            <p className="text-xs text-slate-400">Kosongkan jika hanya update panen/pupuk</p>
          </div>
        </CardContent>
      </Card>

      {/* Foto di BAWAH - sesuai request */}
      <Card className="border-slate-200">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-slate-700" />
            <div className="text-sm font-semibold tracking-tight text-slate-900">Foto Lapangan</div>
            <span className="text-xs text-slate-500">opsional — simpan di bawah</span>
          </div>
          <Button type="button" onClick={triggerFile} className="w-full h-12 rounded-xl border-2 border-dashed border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-sm font-medium touch-manipulation">
            <Camera className="h-4 w-4" /> {file ? file.name.slice(0, 22) : "Ambil Foto / Pilih Galeri"}
          </Button>
          <p className="text-xs text-slate-500 text-center">Kamera HP • Maks 5MB • JPG/PNG/WEBP</p>
          {preview && <img src={preview} alt="preview" className="h-56 w-full object-cover rounded-xl border border-slate-200" />}
          {file && (
            <Button type="button" variant="outline" size="sm" className="w-full rounded-full" onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}>
              Hapus Foto
            </Button>
          )}
        </CardContent>
      </Card>

      {msg && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {msg}
        </div>
      )}
      {err && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}

      <Button type="submit" disabled={loading || !hasChange} className="w-full h-14 sm:h-12 rounded-full bg-green-700 hover:bg-green-800 text-sm font-semibold tracking-tight touch-manipulation">
        {loading ? "Menyimpan..." : <><Save className="h-4 w-4" /> Simpan Update</>}
      </Button>
      <p className="text-center text-xs text-slate-500">Data langsung global — admin lihat di /perkebunan</p>
    </form>
  );
}
