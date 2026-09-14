"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanLine, Camera, Keyboard, AlertCircle, CheckCircle2 } from "lucide-react";

type QrScannerProps = {
  scannerId: string;
  title: string;
  description: string;
  submitLabel?: string;
  accentButtonClass?: string;
  successMessage?: (id: string) => string;
  // Dipanggil setelah ID valid terdeteksi. Default: tidak verifikasi, langsung redirect oleh parent.
  onDecode: (id: string) => void | Promise<void>;
  verifyExists?: (id: string) => Promise<boolean>;
  tips?: string[];
};

// Ekstrak ID pohon dari QR: dukung PHN-XXX mentah, URL /pohon/PHN-XXX, atau ?id=PHN-XXX
function extractPohonId(text: string): string {
  const t = text.trim().toUpperCase();
  const m1 = t.match(/PHN-[A-Z0-9-]+/);
  if (m1) return m1[0];
  try {
    const u = new URL(text.trim());
    const q = u.searchParams.get("id");
    if (q && q.toUpperCase().startsWith("PHN-")) return q.toUpperCase();
    const last = (u.pathname.split("/").pop() || "").toUpperCase();
    if (last.startsWith("PHN-")) return last;
  } catch {
    // bukan URL — abaikan
  }
  return t;
}

/**
 * Komponen scanner QR bersama untuk 3 aktor:
 * - Tamu (publik): onDecode -> router.push(`/pohon/${id}`), tanpa verify (API butuh login)
 * - Admin perkebunan: onDecode -> router.push(`/perkebunan/pohon/${id}/edit`)
 * - Petugas: onDecode -> router.push(`/petugas/pohon/${id}/lapangan`)
 */
export function QrScanner({
  scannerId,
  title,
  description,
  submitLabel = "Buka",
  accentButtonClass = "bg-slate-900 hover:bg-slate-800",
  successMessage = (id) => `Terdeteksi ${id} — membuka...`,
  onDecode,
  verifyExists,
  tips,
}: QrScannerProps) {
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  type ScannerInstance = { stop: () => void | Promise<void>; clear: () => void | Promise<void> };
  const scannerRef = useRef<ScannerInstance | null>(null);

  const getErrorMessage = (e: unknown, fallback: string) => {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    return fallback;
  };

  const startScan = async () => {
    setError(null);
    setSuccess(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const el = document.getElementById(scannerId);
      if (!el) throw new Error("Elemen scanner tidak ditemukan");
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          await scannerRef.current.clear();
        } catch {}
      }
      const html5QrCode = new Html5Qrcode(scannerId, { verbose: false });
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
        (decodedText: string) => handleDecoded(decodedText),
        () => {}
      );
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "");
      if (msg.includes("NotAllowedError") || msg.includes("Permission"))
        setError("Izin kamera ditolak. Aktifkan di pengaturan browser & pakai HTTPS.");
      else if (msg.includes("NotFoundError")) setError("Kamera tidak ditemukan.");
      else setError(msg || "Kamera tidak tersedia. Pakai input manual.");
      setHasCamera(false);
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
      try {
        scannerRef.current?.stop?.()?.catch?.(() => {});
        scannerRef.current?.clear?.()?.catch?.(() => {});
      } catch {}
    };
  }, []);

  const handleDecoded = async (text: string) => {
    const id = extractPohonId(text);
    if (!id.startsWith("PHN-")) {
      setError(`QR tidak valid: ${text.slice(0, 60)}`);
      return;
    }
    setSuccess(successMessage(id));
    await stopScan();
    if (verifyExists) {
      try {
        const ok = await verifyExists(id);
        if (!ok) {
          setError(`Pohon ${id} tidak ditemukan.`);
          setSuccess(null);
          return;
        }
      } catch {
        // tetap lanjut — halaman tujuan akan tampilkan error detail
      }
    }
    await onDecode(id);
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
    <Card className="border-slate-200 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Camera className="h-4 w-4 text-slate-700" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative rounded-2xl border border-slate-200 bg-slate-900 overflow-hidden" style={{ minHeight: scanning ? 360 : 280 }}>
          <style>{`
            #${scannerId} { width: 100% !important; height: 100% !important; min-height: 280px; }
            #${scannerId} video { width: 100% !important; height: 360px !important; object-fit: cover !important; }
            #${scannerId} canvas { display: none !important; }
          `}</style>
          <div id={scannerId} className="w-full h-full" />
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-50">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white border shadow-sm">
                <ScanLine className="h-8 w-8 text-slate-400" />
              </div>
              <div className="text-sm font-medium text-slate-700">Kamera siap</div>
              <div className="text-xs text-slate-500 max-w-[280px]">Tekan Mulai Scan, izinkan kamera. QR di tengah kotak → otomatis dibuka.</div>
              {hasCamera ? (
                <Button onClick={startScan} className={`mt-2 h-11 px-6 rounded-full ${accentButtonClass}`}>
                  <Camera className="h-4 w-4" /> Mulai Scan
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4" /> Kamera tidak didukung, pakai input manual
                </div>
              )}
            </div>
          )}
          {scanning && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">Arahkan QR ke kotak</div>}
        </div>
        {scanning && (
          <Button variant="outline" onClick={stopScan} className="w-full h-11 rounded-full">
            Hentikan Kamera
          </Button>
        )}
        {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}</div>}
        {success && <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5" /> {success}</div>}

        <div className="relative flex items-center gap-3 py-2"><div className="h-px flex-1 bg-slate-200" /><span className="text-xs text-slate-400">atau</span><div className="h-px flex-1 bg-slate-200" /></div>

        <form onSubmit={submitManual} className="space-y-3">
          <Label htmlFor={`${scannerId}-manual`} className="flex items-center gap-1.5"><Keyboard className="h-3.5 w-3.5" /> Input Manual ID</Label>
          <div className="flex gap-2">
            <Input
              id={`${scannerId}-manual`}
              value={manualId}
              onChange={(e) => setManualId(e.target.value.toUpperCase())}
              placeholder="PHN-BLK-A01"
              className="h-11 font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" className={`h-11 px-6 rounded-full shrink-0 ${accentButtonClass}`}>{submitLabel}</Button>
          </div>
        </form>

        {tips && tips.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-600 space-y-1">
            {tips.map((t, i) => (
              <div key={i}>• {t}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
