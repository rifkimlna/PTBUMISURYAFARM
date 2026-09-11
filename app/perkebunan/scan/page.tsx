"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanLine, Camera, Keyboard, AlertCircle, CheckCircle2, Pencil } from "lucide-react";

function AdminScanInner() {
  const router = useRouter();
  const search = useSearchParams();
  const initialId = search.get("id");
  // jika ada ?id= langsung ke edit master
  useEffect(() => {
    if (initialId && /^PHN-[A-Z0-9-]+$/.test(initialId)) {
      router.replace(`/perkebunan/pohon/${encodeURIComponent(initialId)}/edit`);
    }
  }, [initialId, router]);

  const [manualId, setManualId] = useState(initialId || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const scannerRef = useRef<any>(null);

  const startScan = async () => {
    setError(null);
    setSuccess(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const id = "admin-qr-reader";
      const el = document.getElementById(id);
      if (!el) throw new Error("Elemen scanner tidak ditemukan");
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); await scannerRef.current.clear(); } catch {}
      }
      const html5QrCode = new Html5Qrcode(id, { verbose: false });
      scannerRef.current = html5QrCode;
      setScanning(true);
      await new Promise((r) => setTimeout(r, 100));
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (w: number, h: number) => {
            const m = Math.min(w, h);
            const s = Math.min(250, Math.floor(m * 0.7));
            return { width: s, height: s };
          },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText) => handleDecoded(decodedText),
        () => {}
      );
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) setError("Izin kamera ditolak. Aktifkan di pengaturan browser & pakai HTTPS.");
      else if (msg.includes("NotFoundError")) setError("Kamera tidak ditemukan.");
      else setError(msg || "Kamera tidak tersedia. Pakai input manual.");
      setHasCamera(false);
      setScanning(false);
    }
  };

  const stopScan = async () => {
    try {
      if (scannerRef.current) { await scannerRef.current.stop(); await scannerRef.current.clear(); scannerRef.current = null; }
    } catch {}
    setScanning(false);
  };

  useEffect(() => () => { stopScan(); }, []);

  const extractId = (text: string) => {
    const t = text.trim();
    const m1 = t.match(/PHN-[A-Z0-9-]+/);
    if (m1) return m1[0];
    try {
      const u = new URL(t);
      const q = u.searchParams.get("id");
      if (q && q.startsWith("PHN-")) return q;
      const last = u.pathname.split("/").pop() || "";
      if (last.startsWith("PHN-")) return last;
    } catch {}
    return t;
  };

  const handleDecoded = async (text: string) => {
    const id = extractId(text);
    if (!id.startsWith("PHN-")) { setError(`QR tidak valid: ${text.slice(0, 60)}`); return; }
    setSuccess(`Terdeteksi ${id} — buka koreksi data...`);
    await stopScan();
    // verifikasi singkat
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/pohon/${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Pohon tidak ditemukan");
      }
    } catch {}
    router.push(`/perkebunan/pohon/${encodeURIComponent(id)}/edit`);
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) { setError("Masukkan ID pohon, contoh PHN-BLK-A01"); return; }
    handleDecoded(manualId.trim().toUpperCase());
  };

  if (initialId && /^PHN-[A-Z0-9-]+$/.test(initialId)) {
    return <div className="text-sm text-slate-500">Mengalihkan ke koreksi {initialId}...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2"><Pencil className="h-5 w-5 text-slate-700" /> Scan — Koreksi Data Pohon (Admin)</h1>
        <p className="text-sm text-slate-500">Admin full — scan QR batang → edit semua field (identitas + panen/pupuk/obat). Untuk panen harian, petugas input di /petugas.</p>
      </div>

      <Card className="border-slate-200 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Camera className="h-4 w-4 text-slate-700" /> Kamera Scanner</CardTitle>
          <CardDescription>Scan QR PHN-BLK-XXX → langsung buka halaman koreksi lengkap</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative rounded-2xl border border-slate-200 bg-slate-900 overflow-hidden" style={{ minHeight: scanning ? 360 : 280 }}>
            <style>{`
              #admin-qr-reader { width: 100% !important; height: 100% !important; min-height: 280px; }
              #admin-qr-reader video { width: 100% !important; height: 360px !important; object-fit: cover !important; }
              #admin-qr-reader canvas { display: none !important; }
            `}</style>
            <div id="admin-qr-reader" className="w-full h-full" />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-50">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white border shadow-sm"><ScanLine className="h-8 w-8 text-slate-400" /></div>
                <div className="text-sm font-medium text-slate-700">Kamera siap</div>
                <div className="text-xs text-slate-500 max-w-[280px]">Tekan Mulai Scan, izinkan kamera. QR di tengah kotak → otomatis buka Edit Lengkap.</div>
                {hasCamera ? (
                  <Button onClick={startScan} className="mt-2 bg-slate-900 hover:bg-slate-800 h-11 px-6 rounded-full"><Camera className="h-4 w-4" /> Mulai Scan</Button>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"><AlertCircle className="h-4 w-4" /> Kamera tidak didukung, pakai input manual</div>
                )}
              </div>
            )}
            {scanning && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">Arahkan QR ke kotak</div>}
          </div>
          {scanning && <Button variant="outline" onClick={stopScan} className="w-full h-11 rounded-full">Hentikan Kamera</Button>}
          {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}</div>}
          {success && <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5" /> {success}</div>}

          <div className="relative flex items-center gap-3 py-2"><div className="h-px flex-1 bg-slate-200" /><span className="text-xs text-slate-400">atau</span><div className="h-px flex-1 bg-slate-200" /></div>

          <form onSubmit={submitManual} className="space-y-3">
            <Label htmlFor="manualId" className="flex items-center gap-1.5"><Keyboard className="h-3.5 w-3.5" /> Input Manual ID</Label>
            <div className="flex gap-2">
              <Input id="manualId" value={manualId} onChange={(e) => setManualId(e.target.value.toUpperCase())} placeholder="PHN-BLK-A01" className="h-11 font-mono text-sm" autoComplete="off" />
              <Button type="submit" className="h-11 px-6 rounded-full bg-slate-900 hover:bg-slate-800 shrink-0">Buka Edit</Button>
            </div>
            <p className="text-xs text-slate-500">Ketik ID label batang → buka koreksi semua field (blok, varietas, tanggal, koordinat, panen, pupuk, riwayat).</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminScanPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Suspense fallback={<div className="text-sm text-slate-500">Memuat scanner...</div>}>
        <AdminScanInner />
      </Suspense>
    </div>
  );
}
