"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

export function QrModal({ open, onOpenChange, pohonId }: { open: boolean; onOpenChange: (v: boolean) => void; pohonId: string }) {
  const envBase = process.env.NEXT_PUBLIC_APP_URL || "";
  // Selalu pakai origin saat client, fallback ke envBase atau lokasi tunnel
  const url =
    typeof window !== "undefined"
      ? `${envBase || window.location.origin}/pohon/${pohonId}`
      : `${envBase || ""}/pohon/${pohonId}` || `/pohon/${pohonId}`;
  const qrSrc = pohonId ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}` : "";

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cetak QR • {pohonId}</DialogTitle>
          <DialogDescription>Scan untuk membuka halaman publik pohon. Tempel di pohon.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <img src={qrSrc} alt={`QR ${pohonId}`} className="h-60 w-60" />
          </div>
          <div className="text-center">
            <div className="text-sm font-mono font-semibold tracking-widest text-slate-900">{pohonId}</div>
            <div className="text-xs text-slate-500 break-all">{url}</div>
          </div>
          <div className="flex w-full gap-2">
            <a href={qrSrc} download={`${pohonId}-qr.png`} className="flex-1">
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4" /> Download
              </Button>
            </a>
            <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Cetak
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
