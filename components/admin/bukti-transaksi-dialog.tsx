"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/utils";
import { FileText, Image as ImageIcon, Download, Trash2, Loader2, Paperclip } from "lucide-react";

export type BuktiTransaksiRow = {
  id: string;
  transaksiId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
};

type BuktiTransaksiDialogProps = {
  open: boolean;
  transaksi: { id: string; kategori: string; jumlah: number } | null;
  onOpenChange: (open: boolean) => void;
  onDataChange?: () => void;
};

type UploadErrorItem = { fileName?: string; message?: string };

function isImage(fileType: string) {
  return fileType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(fileType);
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function BuktiTransaksiDialog({
  open,
  transaksi,
  onOpenChange,
  onDataChange,
}: BuktiTransaksiDialogProps) {
  const [items, setItems] = useState<BuktiTransaksiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setErrors([]);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!open || !transaksi) return;
    let cancelled = false;
    fetch(`/api/keuangan/bukti?transaksiId=${encodeURIComponent(transaksi.id)}`)
      .then((res) => res.json().then((json) => ({ res, json })))
      .then(({ res, json }) => {
        if (cancelled) return;
        if (res.ok && json.success) setItems(json.data as BuktiTransaksiRow[]);
        else setErrors([json.message || "Gagal memuat bukti"]);
      })
      .catch(() => {
        if (!cancelled) setErrors(["Gagal memuat bukti"]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, transaksi, reloadKey]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !transaksi || uploading) return;
    setUploading(true);
    setErrors([]);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    formData.append("transaksiId", transaksi.id);
    try {
      const res = await fetch("/api/keuangan/bukti", { method: "POST", body: formData });
      const result = await res.json().catch(() => ({ message: "Gagal upload bukti" }));
      if (result.success) {
        const failed = (result.data?.errors ?? []) as UploadErrorItem[];
        if (failed.length > 0) setErrors(failed.map((e) => e.message || e.fileName || "File ditolak"));
        onDataChange?.();
        reload();
      } else {
        const details = (result.details ?? []) as UploadErrorItem[];
        if (details.length > 0) setErrors(details.map((e) => e.message || e.fileName || "File ditolak"));
        else setErrors([result.message || "Gagal upload bukti"]);
      }
    } catch {
      setErrors(["Gagal upload bukti"]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (row: BuktiTransaksiRow) => {
    if (!window.confirm(`Hapus bukti "${row.fileName}"?`)) return;
    setDeleting(row.id);
    setErrors([]);
    try {
      const res = await fetch(`/api/keuangan/bukti/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({ message: "Gagal menghapus bukti" }));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus bukti");
      onDataChange?.();
      reload();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Gagal menghapus bukti"]);
    } finally {
      setDeleting(null);
    }
  };

  const close = () => {
    onOpenChange(false);
    setItems([]);
    setErrors([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(openNext) => {
        onOpenChange(openNext);
        if (!openNext) {
          setItems([]);
          setErrors([]);
        }
      }}
    >
      <DialogContent onClose={close} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bukti Transaksi</DialogTitle>
          <DialogDescription>
            {transaksi ? `${transaksi.kategori} — Rp ${formatRupiah(transaksi.jumlah)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex h-24 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat bukti...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              Belum ada bukti transaksi.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-3"
                >
                  {isImage(item.fileType) ? (
                    <ImageIcon className="h-4 w-4 shrink-0 text-sky-500" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-slate-700">{item.fileName}</div>
                    <div className="text-[11px] text-slate-400">{formatFileSize(item.fileSize)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={item.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-[11px]")}
                    >
                      Lihat
                    </a>
                    <a
                      href={`/api/keuangan/bukti/${encodeURIComponent(item.id)}/download`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-[11px]")}
                      title={`Download ${item.fileName}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 rounded-full p-0 text-slate-400 hover:text-red-600"
                      onClick={() => handleDelete(item)}
                      disabled={deleting === item.id}
                      title="Hapus bukti"
                    >
                      {deleting === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {errors.length > 0 && (
            <div className="rounded-md bg-red-50 p-3 text-xs text-red-600">
              <ul className="list-disc space-y-1 pl-4">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(event) => handleUpload(event.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
            {uploading ? "Mengupload..." : "+ Tambah Bukti"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}