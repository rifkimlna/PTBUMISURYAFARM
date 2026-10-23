"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TipeBiaya = "TUNAI" | "HUTANG";

const SUMBER_DANA_OPTIONS = [
  { value: "KAS", label: "Kas" },
  { value: "BANK", label: "Bank" },
  { value: "TABUNGAN", label: "Tabungan" },
];

export function BiayaFormDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [tipe, setTipe] = useState<TipeBiaya>("TUNAI");
  const [tanggal, setTanggal] = useState("");
  const [jatuhTempo, setJatuhTempo] = useState("");
  const [kategori, setKategori] = useState("");
  const [kodeAkun, setKodeAkun] = useState("");
  const [penerima, setPenerima] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [sumberDana, setSumberDana] = useState<"KAS" | "BANK" | "TABUNGAN" | "">("");
  const [tags, setTags] = useState("");
  const [memo, setMemo] = useState("");
  const [transaksiKasId, setTransaksiKasId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: {
        tipe: TipeBiaya;
        tanggal: string;
        jatuhTempo?: string;
        kategori: string;
        kodeAkun?: string | null;
        penerima: string;
        jumlah: number;
        sumberDana?: string | null;
        tags?: string | null;
        memo?: string | null;
        transaksiKasId?: string | null;
      } = {
        tipe,
        tanggal,
        kategori,
        penerima,
        jumlah: Number(jumlah),
      };

      if (tipe === "TUNAI") {
        if (!sumberDana) throw new Error("Sumber dana wajib dipilih");
        if (!transaksiKasId) {
          payload.sumberDana = sumberDana;
        } else {
          payload.transaksiKasId = transaksiKasId;
        }
      } else if (tipe === "HUTANG") {
        if (!jatuhTempo) throw new Error("Jatuh tempo wajib diisi");
        payload.jatuhTempo = jatuhTempo;
      }

      if (kodeAkun.trim()) payload.kodeAkun = kodeAkun.trim();
      if (tags.trim()) payload.tags = tags.trim();
      if (memo.trim()) payload.memo = memo.trim();

      const res = await fetch("/api/keuangan/biaya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({ message: "Gagal membuat biaya" }));
      if (!res.ok) {
        const detail = Array.isArray((result as { errors?: { message: string }[] }).errors)
          ? (result as { errors: { message: string }[] }).errors.map((x) => x.message).join("; ")
          : null;
        throw new Error(detail || result.message || "Gagal membuat biaya");
      }
      onSuccess();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat biaya");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTipe("TUNAI");
    setTanggal(today);
    setJatuhTempo("");
    setKategori("");
    setKodeAkun("");
    setPenerima("");
    setJumlah("");
    setSumberDana("");
    setTags("");
    setMemo("");
    setTransaksiKasId("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buat Biaya Baru</DialogTitle>
          <DialogDescription>Catat pengeluaran baru sebagai biaya tunai atau hutang.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 w-fit max-w-md">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 block mb-1">Tipe Biaya</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTipe("TUNAI")}
                className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                  tipe === "TUNAI"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Tunai
              </button>
              <button
                type="button"
                onClick={() => setTipe("HUTANG")}
                className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                  tipe === "HUTANG"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Hutang (Bayar Nanti)
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tanggal</label>
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
          </div>

          {tipe === "HUTANG" && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Jatuh Tempo</label>
              <Input type="date" value={jatuhTempo} onChange={(e) => setJatuhTempo(e.target.value)} required />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Kategori</label>
            <Input
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              placeholder="Contoh: Beban Upah dan Gaji Pekerja"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Kode Akun COA (opsional)</label>
            <Input
              value={kodeAkun}
              onChange={(e) => setKodeAkun(e.target.value)}
              placeholder="Contoh: 5101"
              maxLength={10}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Penerima</label>
            <Input
              value={penerima}
              onChange={(e) => setPenerima(e.target.value)}
              placeholder="Nama penerima / supplier"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Jumlah (Rp)</label>
            <Input
              type="number"
              min="1000"
              step="1000"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              required
              className="text-right"
            />
          </div>

          {tipe === "TUNAI" && !transaksiKasId && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Sumber Dana</label>
              <Select value={sumberDana} onChange={(e) => setSumberDana(e.target.value as "KAS" | "BANK" | "TABUNGAN" | "")} required>
                <option value="">Pilih sumber dana</option>
                {SUMBER_DANA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 block mb-1">Tags (opsional)</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Contoh: gaji, listrik" />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 block mb-1">Keterangan (opsional)</label>
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Catatan tambahan" />
          </div>

          {error && (
            <div className="sm:col-span-2 rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</div>
          )}

          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onClose()}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Biaya"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
