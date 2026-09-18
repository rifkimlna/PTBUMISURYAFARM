"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { FileText, Building, CreditCard, Wallet, DollarSign, MinusCircle, Plus, Search, X, Edit, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GOLOGAN_BY_KELOMPOK } from "@/lib/coa";
import type { AkunCOA } from "@/lib/coa";
import { CoaFormModal } from "@/components/admin/coa-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CoaListProps {
  grouped: Record<string, Record<string, AkunCOA[]>>;
  kelompokUrutan: ("Aset" | "Kewajiban" | "Modal" | "Pendapatan" | "Beban")[];
  userRole?: string;
}

const kelompokIcons: Record<string, React.ElementType> = {
  Aset: Building,
  Kewajiban: CreditCard,
  Modal: Wallet,
  Pendapatan: DollarSign,
  Beban: MinusCircle,
};

const kelompokColors: Record<string, string> = {
  Aset: "bg-blue-50 text-blue-700 border-blue-200",
  Kewajiban: "bg-orange-50 text-orange-700 border-orange-200",
  Modal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pendapatan: "bg-green-50 text-green-700 border-green-200",
  Beban: "bg-red-50 text-red-700 border-red-200",
};

const isSuperAdmin = (role?: string) => role === "SUPER_ADMIN";

function sortGolonganByKode(golonganMap: Record<string, AkunCOA[]>, kelompok: string): [string, AkunCOA[]][] {
  const golonganOrder = GOLOGAN_BY_KELOMPOK[kelompok as keyof typeof GOLOGAN_BY_KELOMPOK] || [];
  const entries = Object.entries(golonganMap);
  
  return entries.sort(([golonganA, akunListA], [golonganB, akunListB]) => {
    const minKodeA = Math.min(...akunListA.map(a => parseInt(a.kode, 10) || 0));
    const minKodeB = Math.min(...akunListB.map(a => parseInt(a.kode, 10) || 0));
    
    const indexA = golonganOrder.indexOf(golonganA);
    const indexB = golonganOrder.indexOf(golonganB);
    
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    return minKodeA - minKodeB;
  });
}

export function CoaList({ grouped, kelompokUrutan, userRole }: CoaListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAkun, setEditingAkun] = useState<AkunCOA | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingAkun, setDeletingAkun] = useState<AkunCOA | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleOpenCreate = () => {
    setEditingAkun(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (akun: AkunCOA) => {
    setEditingAkun(akun);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingAkun(null);
  };

  const handleOpenDelete = (akun: AkunCOA) => {
    setDeletingAkun(akun);
    setDeleteError("");
  };

  const handleCloseDelete = () => {
    setDeletingAkun(null);
    setDeleteError("");
  };

  const handleDelete = async () => {
    if (!deletingAkun) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/keuangan/coa/${deletingAkun.kode}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gagal menghapus akun");
      handleCloseDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Gagal menghapus akun");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setSubmitting(true);
    try {
      const isEdit = !!editingAkun;
      const url = isEdit ? `/api/keuangan/coa/${editingAkun.kode}` : "/api/keuangan/coa";
      const method = isEdit ? "PUT" : "POST";

      const body: Record<string, unknown> = {};
      formData.forEach((value, key) => {
        body[key] = value;
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gagal menyimpan akun");

      handleCloseModal();
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    
    const query = searchQuery.toLowerCase().trim();
    const result: Record<string, Record<string, AkunCOA[]>> = {};
    
    for (const [kelompok, golonganMap] of Object.entries(grouped)) {
      result[kelompok] = {};
      for (const [golongan, akunList] of Object.entries(golonganMap)) {
        const filtered = akunList.filter(akun => 
          akun.kode.toLowerCase().includes(query) || 
          akun.nama.toLowerCase().includes(query)
        );
        if (filtered.length > 0) {
          result[kelompok][golongan] = filtered;
        }
      }
    }
    return result;
  }, [grouped, searchQuery]);

  const hasResults = useMemo(() => {
    return Object.values(filteredGrouped).some(golonganMap => 
      Object.values(golonganMap).some(akunList => akunList.length > 0)
    );
  }, [filteredGrouped]);

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Daftar Akun (COA)
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Chart of Accounts PT Bumi Surya Farm — klik akun untuk melihat detail transaksi.
          </p>
        </div>
        {isSuperAdmin(userRole) && (
          <Button onClick={handleOpenCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Tambah Akun
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Cari kode atau nama akun..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-9 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Hapus pencarian"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* COA List */}
      <div className="space-y-6">
        {!hasResults && searchQuery && (
          <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center">
            <p className="text-slate-500">Akun tidak ditemukan</p>
          </div>
        )}
        {kelompokUrutan.map((kelompok) => {
          const golonganMap = filteredGrouped[kelompok];
          const Icon = kelompokIcons[kelompok];
          const colorClass = kelompokColors[kelompok];

          if (!golonganMap || Object.keys(golonganMap).length === 0) return null;

          const sortedGolongan = sortGolonganByKode(golonganMap, kelompok);

          return (
            <div key={kelompok} className="rounded-2xl border border-slate-100 bg-white">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", colorClass)}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">{kelompok}</h2>
                  <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {Object.values(golonganMap).reduce((sum, arr) => sum + arr.length, 0)} akun
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {sortedGolongan.map(([golongan, akunList]) => (
                  <div key={golongan} className="space-y-2">
                    <h3 className="text-xs font-medium tracking-wide text-slate-400 uppercase">{golongan}</h3>
                    <div className="space-y-1">
                      {akunList
                        .slice()
                        .sort((a, b) => parseInt(a.kode, 10) - parseInt(b.kode, 10))
                        .map((akun) => (
                          <div
                            key={akun.kode}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors group relative"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors">
                              <FileText className="h-4 w-4 text-slate-400 group-hover:text-slate-600" aria-hidden="true" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/keuangan/coa/${akun.kode}`}
                                className="block"
                              >
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {akun.kode} - {akun.nama}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Tipe: {akun.tipe === "NETRAL" ? "Saldo" : akun.tipe}
                                  {akun.deskripsi && ` • ${akun.deskripsi}`}
                                </p>
                              </Link>
                            </div>
                            <div className="flex items-center gap-1">
                              {isSuperAdmin(userRole) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleOpenEdit(akun);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                    title="Edit akun"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleOpenDelete(akun);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Hapus akun"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingAkun && (
        <Dialog open={true} onOpenChange={handleCloseDelete}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
              <DialogTitle className="text-lg font-semibold">Hapus Akun COA</DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                Apakah Anda yakin ingin menghapus akun <strong>{deletingAkun.kode} - {deletingAkun.nama}</strong>?
                <br />Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </DialogHeader>
            {deleteError && (
              <div className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-600">{deleteError}</div>
            )}
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" onClick={handleCloseDelete} disabled={deleteLoading}>
                Batal
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Hapus
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add/Edit Modal */}
      <CoaFormModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        editingAkun={editingAkun}
        loading={submitting}
      />
    </div>
  );
}