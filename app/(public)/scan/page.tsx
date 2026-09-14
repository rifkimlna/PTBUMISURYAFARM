"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrScanner } from "@/components/features/scan/qr-scanner";
import { ScanLine, ArrowLeft } from "lucide-react";

// Halaman publik TAMU — tanpa login. Scan QR batang -> /pohon/[id] (publik).
export default function PublicScanPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      <Suspense fallback={<div className="text-sm text-slate-500">Memuat scanner...</div>}>
        <PublicScanInner />
      </Suspense>
    </div>
  );
}

function PublicScanInner() {
  const router = useRouter();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5" /> Beranda
        </Link>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-green-700" /> Scan QR Pohon
        </h1>
        <p className="text-sm text-slate-500">Tamu — scan QR di batang pohon untuk melihat data pohon (tanpa login, tanpa aplikasi).</p>
      </div>

      <QrScanner
        scannerId="public-qr-reader"
        title="Kamera Scanner Tamu"
        description="Scan QR PHN-BLK-XXX → langsung buka data pohon publik"
        submitLabel="Lihat"
        accentButtonClass="bg-green-700 hover:bg-green-800"
        successMessage={(id) => `Terdeteksi ${id} — membuka data pohon...`}
        onDecode={(id) => router.push(`/pohon/${encodeURIComponent(id)}`)}
        tips={[
          "Tidak perlu login atau aplikasi tambahan.",
          "Jika QR rusak, ketik ID yang tertera di label batang (contoh PHN-BLK-A01).",
        ]}
      />
    </div>
  );
}
