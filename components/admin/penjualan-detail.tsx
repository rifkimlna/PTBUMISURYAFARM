"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";

export type TindakanKind = "PESANAN" | "PENAWARAN" | "PENAGIHAN";

// Tombol "Tindakan" ala Mekari yang disesuaikan untuk PT BST (tanpa approval,
// tanpa transaksi berulang/proforma-order/pemenuhan/deposit yang belum ada alurnya).
// - Pesanan: Duplikat, Buat Pengiriman, Buat Penagihan, Tutup/Buka Pesanan.
// - Penawaran: Duplikat, Buat Pesanan, Buat Penagihan, Tutup/Buka Penawaran.
// - Penagihan: Duplikat saja (pembayaran tetap lewat dialog Detail Penagihan).
export function TindakanDropdown({
  kind,
  docId,
  status,
}: {
  kind: TindakanKind;
  docId: string;
  status: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const ditutup = status === "DITUTUP" || status === "SELESAI";

  const toggleTutup = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/penjualan/dokumen/${encodeURIComponent(docId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: ditutup ? "TERBUKA" : "DITUTUP" }),
      });
      const result = await res.json().catch(() => ({ message: "Gagal ubah status" }));
      if (!res.ok) throw new Error(result.message || "Gagal ubah status");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal ubah status");
    } finally {
      setBusy(false);
    }
  };

  const hapus = async (label: string) => {
    if (!window.confirm(`Hapus ${label} ini? Piutang ikutannya (bila ada dan belum dibayar) ikut terhapus.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/penjualan/dokumen/${encodeURIComponent(docId)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({ message: "Gagal menghapus" }));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus");
      router.push("/keuangan/penjualan?tab=" + (kind === "PESANAN" ? "pesanan" : kind === "PENAWARAN" ? "penawaran" : "penagihan"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus");
    } finally {
      setBusy(false);
    }
  };

  const itemCls =
    "flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} disabled={busy}>
        Tindakan
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {kind === "PESANAN" && (
            <>
              <Link href={`/keuangan/penjualan/pesanan/baru?dari=${docId}&mode=duplikat`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
                <span><span className="block font-medium text-slate-900">Duplikat transaksi</span><span className="block text-xs text-slate-500">Salin sebagai pesanan baru</span></span>
              </Link>
              <Link href={`/keuangan/penjualan/pengiriman/baru?pesananId=${docId}`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
                <span><span className="block font-medium text-slate-900">Buat Pengiriman</span><span className="block text-xs text-slate-500">Kirim barang sesuai pesanan</span></span>
              </Link>
              <Link href={`/keuangan/penjualan/penagihan/baru?dari=${docId}`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
                <span><span className="block font-medium text-slate-900">Buat Penagihan</span><span className="block text-xs text-slate-500">Tagih pesanan ini (jadi piutang)</span></span>
              </Link>
              <button type="button" role="menuitem" className={itemCls} disabled={busy} onClick={toggleTutup}>
                <span><span className="block font-medium text-slate-900">{ditutup ? "Buka kembali pesanan" : "Tutup pesanan"}</span><span className="block text-xs text-slate-500">{ditutup ? "Status kembali TERBUKA" : "Tandai selesai/ditutup"}</span></span>
              </button>
            </>
          )}
          {kind === "PENAWARAN" && (
            <>
              <Link href={`/keuangan/penjualan/penawaran/baru?dari=${docId}&mode=duplikat`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
                <span><span className="block font-medium text-slate-900">Duplikat transaksi</span><span className="block text-xs text-slate-500">Salin sebagai penawaran baru</span></span>
              </Link>
              <Link href={`/keuangan/penjualan/pesanan/baru?dari=${docId}`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
                <span><span className="block font-medium text-slate-900">Buat Pesanan</span><span className="block text-xs text-slate-500">Lanjutkan penawaran jadi pesanan</span></span>
              </Link>
              <Link href={`/keuangan/penjualan/penagihan/baru?dari=${docId}`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
                <span><span className="block font-medium text-slate-900">Buat Penagihan</span><span className="block text-xs text-slate-500">Tagih langsung (jadi piutang)</span></span>
              </Link>
              <button type="button" role="menuitem" className={itemCls} disabled={busy} onClick={toggleTutup}>
                <span><span className="block font-medium text-slate-900">{ditutup ? "Buka kembali penawaran" : "Tutup penawaran"}</span><span className="block text-xs text-slate-500">{ditutup ? "Status kembali TERBUKA" : "Tandai selesai/ditutup"}</span></span>
              </button>
            </>
          )}
          {kind === "PENAGIHAN" && (
            <Link href={`/keuangan/penjualan/penagihan/baru?dari=${docId}&mode=duplikat`} role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
              <span><span className="block font-medium text-slate-900">Duplikat transaksi</span><span className="block text-xs text-slate-500">Salin sebagai penagihan baru</span></span>
            </Link>
          )}
          <div className="border-t border-slate-100" />
          <button type="button" role="menuitem" className={itemCls} disabled={busy} onClick={() => hapus(kind === "PESANAN" ? "pesanan" : kind === "PENAWARAN" ? "penawaran" : "penagihan")}>
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <span><span className="block font-medium text-red-600">Hapus</span></span>
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function UbahButton({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
      <Pencil className="h-3.5 w-3.5" /> Ubah
    </Link>
  );
}
