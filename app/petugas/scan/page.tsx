"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Keyboard, ScanLine, AlertCircle, CheckCircle2 } from "lucide-react";

export default function PetugasScanPage() {
  const router = useRouter();
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const scannerRef = useRef<any>(null);
  const divRef = useRef<HTMLDivElement>(null);

  // Start scanner
  const startScan = async () => {
    setError(null);
    setSuccess(null);
    if (typeof window === "undefined") return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!divRef.current) return;
      const id = "petugas-qr-reader";
      // ensure div exists
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        divRef.current.appendChild(el);
      }
      const html5QrCode = new Html5Qrcode(id);
      scannerRef.current = html5QrCode;
      setScanning(true);
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => {
          handleDecoded(decodedText);
        },
        () => {}
      );
    } catch (e: any) {
      setHasCamera(false);
      setError(e?.message || "Kamera tidak tersedia. Gunakan input manual.");
      setScanning(false);
    }
  };

  const stopScan = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch {}
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, []);

  const extractId = (text: string) => {
    // Support: PHN-BLK-XXX, https://.../pohon/PHN-BLK-XXX, https://.../pohon?id=PHN-...
    const t = text.trim();
    // direct PHN
    const m1 = t.match(/PHN-[A-Z0-9-]+/);
    if (m1) return m1[0];
    // url param
    try {
      const u = new URL(t);
      const id = u.searchParams.get("id");
      if (id && id.startsWith("PHN-")) return id;
      const parts = u.pathname.split("/");
      const last = parts[parts.length - 1];
      if (last.startsWith("PHN-")) return last;
    } catch {}
    return t;
  };

  const handleDecoded = async (text: string) => {
    const id = extractId(text);
    if (!id.startsWith("PHN-")) {
      setError(`QR tidak valid: ${text.slice(0, 60)}`);
      return;
    }
    setSuccess(`Terdeteksi ${id} — membuka form lapangan...`);
    await stopScan();
    // verify exists then redirect
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/pohon/${encodeURIComponent(id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Pohon tidak ditemukan");
      }
    } catch (e: any) {
      // still redirect, let lapangan page show error
    }
    router.push(`/petugas/pohon/${encodeURIComponent(id)}/lapangan`);
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) {
      setError("Masukkan ID pohon, contoh PHN-BLK-A01");
      return;
    }
    handleDecoded(manualId.trim());
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center sm:text-left">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Scan QR Pohon</h1>
        <p className="mt-1 text-sm text-slate-500">Scan batang pohon → langsung update lapangan. Data global, admin ikut terupdate.</p>
      </div>

      <Card className="border-slate-200 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="h-4 w-4 text-green-700" /> Kamera Scanner
          </CardTitle>
          <CardDescription>Arahkan kamera ke QR di batang (PHN-BLK-XXX). Otomatis buka form lapangan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            ref={divRef}
            className="relative rounded-2xl border border-slate-200 bg-black overflow-hidden min-h-[280px] sm:min-h-[360px]"
          >
            <div id="petugas-qr-reader" className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-50">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm">
                  <ScanLine className="h-8 w-8 text-slate-400" />
                </div>
                <div className="text-sm font-medium text-slate-700">Kamera siap</div>
                <div className="text-xs text-slate-500 max-w-[260px]">Tekan Mulai Scan, izinkan akses kamera. Posisikan QR di tengah kotak 250x250.</div>
                {hasCamera ? (
                  <Button onClick={startScan} className="mt-2 bg-green-700 hover:bg-green-800 h-11 px-6 rounded-full">
                    <Camera className="h-4 w-4" /> Mulai Scan
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertCircle className="h-4 w-4" /> Kamera tidak didukung, gunakan input manual di bawah
                  </div>
                )}
              </div>
            )}
            {scanning && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
                Arahkan QR ke kotak hijau
              </div>
            )}
          </div>

          {scanning && (
            <Button variant="outline" onClick={stopScan} className="w-full h-11 rounded-full">
              Hentikan Kamera
            </Button>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> <span>{success}</span>
            </div>
          )}

          <div className="relative flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">atau</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={submitManual} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="manualId" className="flex items-center gap-1.5">
                <Keyboard className="h-3.5 w-3.5" /> Input Manual ID
              </Label>
              <div className="flex gap-2">
                <Input
                  id="manualId"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value.toUpperCase())}
                  placeholder="PHN-BLK-A01"
                  className="h-11 font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="submit" className="h-11 px-6 rounded-full bg-slate-900 hover:bg-slate-800 shrink-0">
                  Buka
                </Button>
              </div>
              <p className="text-xs text-slate-500">Jika QR rusak, ketik ID yang tertera di label batang.</p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-100 bg-slate-50/50">
        <CardContent className="p-4 text-xs text-slate-600 space-y-1">
          <div className="font-medium text-slate-700">Tips lapangan:</div>
          <div>• Data lapangan global — admin di <span className="font-mono">/admin/pertanian</span> otomatis terupdate setelah kamu simpan.</div>
          <div>• Hasil panen KG akan masuk chart trend 6-bulan.</div>
          <div>• Foto geotag wajib GPS/EXIF, cek akurasi &lt;25m.</div>
        </CardContent>
      </Card>
    </div>
  );
}
