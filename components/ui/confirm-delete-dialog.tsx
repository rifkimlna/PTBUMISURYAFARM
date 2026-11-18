"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  itemName?: string;
  warning?: string;
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName = "data",
  warning,
  onConfirm,
  confirmLabel = "Ya, Hapus",
}: ConfirmDeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);
      await onConfirm();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? "Gagal menghapus");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <DialogTitle>Hapus {itemName}?</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {description ?? `Anda akan menghapus ${itemName}.`}
            {error && <span className="mt-2 block text-sm text-red-600">{error}</span>}
          </DialogDescription>
          {warning && (
            <div className="mt-2 flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span className="text-sm">{warning}</span>
            </div>
          )}
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Menghapus..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
