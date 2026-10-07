"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { STATIC_COA_PEMASUKAN, STATIC_COA_PENGELUARAN } from "@/lib/coa";
import {
  MONITOR_LIHAT_BALIK,
  MONITOR_TAMPIL_SETIAP,
  MONITOR_TEMPLATE,
  MONITOR_TEMPLATE_LABEL,
  type MonitorLihatBalik,
  type MonitorSnapshot,
  type MonitorTampilSetiap,
  type MonitorTemplate,
} from "@/lib/anggaran-monitor-types";

// Anggaran Laba Rugi — pola halaman laporan Mekari Jurnal:
// 1. "Lihat laporan" membuka modal "Pilih anggaran yang ingin dimonitor"
//    (dropdown dari data anggaran ASLI, bukan dummy).
// 2. "Lanjutkan" membuka detail "Anggaran laba rugi: [nama]" berisi filter
//    periode + tabel Anggaran vs Aktual per section (expand/collapse).
// Pembuatan/ubah anggaran (setup/tabel) dipertahankan apa adanya.

// 4105 Penerimaan Piutang adalah mutasi neraca (bukan pendapatan baru) —
// dikecualikan mengikuti logic laba rugi.
const KODE_NON_LABA_RUGI = new Set(["4105"]);

const URUTAN_GOLONGAN = [
  "Pendapatan Usaha",
  "Pendapatan Lainnya",
  "Beban Tenaga Kerja",
  "Beban Produksi",
  "Beban Perlengkapan & Peralatan",
  "Beban Operasional",
  "Pelunasan Hutang",
];

type Akun = { kode: string; nama: string; kelompok: "Pendapatan" | "Beban"; golongan: string };
type Bulan = { tahun: number; bulan: number };
type BudgetRow = { id: string; nama: string; tahunMulai: number; bulanMulai: number; durasi: number; updatedAt: string };

function ymKey(tahun: number, bulan: number) {
  return `${tahun}-${String(bulan).padStart(2, "0")}`;
}
function labelBulan(b: Bulan) {
  return new Date(b.tahun, b.bulan - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}
function labelBulanSingkat(b: Bulan) {
  return new Date(b.tahun, b.bulan - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}
function parseMonth(v: string): Bulan | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return null;
  const tahun = Number(m[1]);
  const bulan = Number(m[2]);
  if (bulan < 1 || bulan > 12) return null;
  return { tahun, bulan };
}
function monthsBetween(a: Bulan, b: Bulan): Bulan[] {
  const out: Bulan[] = [];
  let t = a.tahun;
  let m = a.bulan;
  for (;;) {
    out.push({ tahun: t, bulan: m });
    if (t === b.tahun && m === b.bulan) break;
    m += 1;
    if (m > 12) {
      m = 1;
      t += 1;
    }
    if (out.length > 12) break; // pengaman
  }
  return out;
}
function rp(v: number) {
  const n = Math.round(Number(v) || 0);
  if (n < 0) return `(Rp ${formatRupiah(Math.abs(n))})`;
  return `Rp ${formatRupiah(n)}`;
}

function coaFallback(): Akun[] {
  return [
    ...STATIC_COA_PEMASUKAN.filter((a) => !KODE_NON_LABA_RUGI.has(a.kode)).map((a) => ({
      kode: a.kode,
      nama: a.nama,
      kelompok: "Pendapatan" as const,
      golongan: a.golongan,
    })),
    ...STATIC_COA_PENGELUARAN.map((a) => ({
      kode: a.kode,
      nama: a.nama,
      kelompok: "Beban" as const,
      golongan: a.golongan,
    })),
  ];
}

type MonitorFilter = {
  berakhirPada: string;
  lihatBalik: MonitorLihatBalik;
  tampilSetiap: MonitorTampilSetiap;
  template: MonitorTemplate;
};

function defaultBerakhirPada() {
  return `${new Date().getFullYear()}-12`;
}

export function AnggaranLabaRugiContent() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-slate-400">Memuat Anggaran Laba Rugi...</p>}>
      <AnggaranLabaRugiIsi />
    </Suspense>
  );
}

function AnggaranLabaRugiIsi() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramAnggaran = searchParams.get("anggaran");
  const paramBaru = searchParams.get("baru");
  const paramKelola = searchParams.get("kelola");

  const [mode, setMode] = useState<"memilih" | "monitor" | "setup" | "tabel">("memilih");
  const [budgets, setBudgets] = useState<BudgetRow[] | null>(null);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // ---- Modal pilih anggaran ----
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPilih, setModalPilih] = useState("");

  // ---- Monitor ----
  const [anggaranId, setAnggaranId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MonitorFilter>({
    berakhirPada: defaultBerakhirPada(),
    lihatBalik: 12,
    tampilSetiap: 1,
    template: "standar",
  });
  const [applied, setApplied] = useState<MonitorFilter | null>(null);
  const [snap, setSnap] = useState<MonitorSnapshot | null>(null);
  const [monLoading, setMonLoading] = useState(false);
  const [monError, setMonError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    revenue: true,
    cos: true,
    opex: true,
    otherIncome: true,
    otherExpense: true,
  });
  const [menuUnduh, setMenuUnduh] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  // ---- Pembuatan/ubah anggaran (dipertahankan) ----
  const [akun, setAkun] = useState<Akun[]>(coaFallback());
  const [nama, setNama] = useState("");
  const [mulai, setMulai] = useState("");
  const [hingga, setHingga] = useState("");
  const [setupError, setSetupError] = useState("");
  const [months, setMonths] = useState<Bulan[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [tableError, setTableError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Daftar anggaran tersimpan (data asli).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/keuangan/anggaran-laba-rugi", { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setBudgets(j.data as BudgetRow[]);
          setListError("");
        } else {
          setListError(j?.message || "Gagal memuat daftar anggaran");
        }
      })
      .catch(() => {
        if (!cancelled) setListError("Gagal memuat daftar anggaran");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Daftar akun terbaru dari COA sistem (fallback statis bila API gagal).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, b] = await Promise.all([
          fetch("/api/keuangan/coa?kelompok=Pendapatan&isActive=true", { credentials: "include" }).then((r) => r.json()),
          fetch("/api/keuangan/coa?kelompok=Beban&isActive=true", { credentials: "include" }).then((r) => r.json()),
        ]);
        const rows: Akun[] = [];
        for (const j of [p, b]) {
          if (j?.success && Array.isArray(j.data)) {
            for (const a of j.data) {
              if (KODE_NON_LABA_RUGI.has(a.kode)) continue;
              rows.push({ kode: a.kode, nama: a.nama, kelompok: a.kelompok, golongan: a.golongan });
            }
          }
        }
        if (!cancelled && rows.length > 0) setAkun(rows);
      } catch {
        // fallback statis sudah terpasang
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bukaMonitor = useCallback(
    (id: string, f?: MonitorFilter) => {
      const flt =
        f ?? { berakhirPada: defaultBerakhirPada(), lihatBalik: 12 as MonitorLihatBalik, tampilSetiap: 1 as MonitorTampilSetiap, template: "standar" as MonitorTemplate };
      setAnggaranId(id);
      setDraft(flt);
      setApplied(flt);
      setModalOpen(false);
      setMode("monitor");
      router.push(`${pathname}?anggaran=${id}`, { scroll: false });
    },
    [pathname, router]
  );

  // Deep-link: ?baru=1 langsung ke form buat anggaran (dari Manajemen Anggaran).
  // ?anggaran=...&kelola=edit langsung ke mode ubah nilai anggaran.
  // ?anggaran=... langsung ke monitor; tanpa itu buka modal bila ada anggaran.
  useEffect(() => {
    if (budgets === null) return;
    if (paramBaru) {
      setNama("");
      setMulai("");
      setHingga("");
      setSetupError("");
      setModalOpen(false);
      setMode("setup");
      return;
    }
    if (paramAnggaran && budgets.some((b) => b.id === paramAnggaran)) {
      if (paramKelola === "edit") {
        if (editingId !== paramAnggaran && !loadingDetail) void bukaBudget(paramAnggaran);
      } else if (anggaranId !== paramAnggaran) {
        bukaMonitor(paramAnggaran);
      }
      return;
    }
    if (mode === "memilih") {
      if (budgets.length > 0) {
        setModalPilih((v) => v || budgets[0].id);
        setModalOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, paramAnggaran, paramBaru, paramKelola]);

  const queryMonitor = useCallback(() => {
    if (!anggaranId || !applied) return "";
    const p = new URLSearchParams({
      anggaranId,
      berakhirPada: applied.berakhirPada,
      lihatBalik: String(applied.lihatBalik),
      tampilSetiap: String(applied.tampilSetiap),
      template: applied.template,
    });
    return p.toString();
  }, [anggaranId, applied]);

  useEffect(() => {
    if (mode !== "monitor" || !anggaranId || !applied) return;
    let cancelled = false;
    setMonLoading(true);
    setMonError("");
    setSnap(null);
    fetch(`/api/keuangan/laporan/anggaran-laba-rugi?${queryMonitor()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setSnap((j.data as { snapshot: MonitorSnapshot }).snapshot);
        } else {
          setMonError(j?.message || "Gagal memuat monitor anggaran");
        }
      })
      .catch(() => {
        if (!cancelled) setMonError("Gagal memuat monitor anggaran");
      })
      .finally(() => {
        if (!cancelled) setMonLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, anggaranId, applied, queryMonitor]);

  const groups = useMemo(() => {
    const map = new Map<string, { kelompok: "Pendapatan" | "Beban"; golongan: string; akun: Akun[] }>();
    for (const a of akun) {
      const key = `${a.kelompok}|${a.golongan}`;
      const g = map.get(key) ?? { kelompok: a.kelompok, golongan: a.golongan, akun: [] };
      g.akun.push(a);
      map.set(key, g);
    }
    for (const g of map.values()) g.akun.sort((x, y) => x.kode.localeCompare(y.kode));
    const urut = (golongan: string) => {
      const i = URUTAN_GOLONGAN.indexOf(golongan);
      return i === -1 ? 99 : i;
    };
    const pend = [...map.values()]
      .filter((g) => g.kelompok === "Pendapatan")
      .sort((x, y) => urut(x.golongan) - urut(y.golongan) || x.golongan.localeCompare(y.golongan));
    const beban = [...map.values()]
      .filter((g) => g.kelompok === "Beban")
      .sort((x, y) => urut(x.golongan) - urut(y.golongan) || x.golongan.localeCompare(y.golongan));
    return { pend, beban };
  }, [akun]);

  const val = (kode: string, b: Bulan) => values[`${kode}|${ymKey(b.tahun, b.bulan)}`] ?? 0;

  const totals = useMemo(() => {
    const perBulan = months.map((b) => {
      let pend = 0;
      let beban = 0;
      for (const g of groups.pend) for (const a of g.akun) pend += val(a.kode, b);
      for (const g of groups.beban) for (const a of g.akun) beban += val(a.kode, b);
      return { pend, beban, profit: pend - beban };
    });
    const sum = (f: (t: { pend: number; beban: number; profit: number }) => number) =>
      perBulan.reduce((s, t) => s + f(t), 0);
    return { perBulan, totalPend: sum((t) => t.pend), totalBeban: sum((t) => t.beban), totalProfit: sum((t) => t.profit) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, values, groups]);

  const groupSubtotal = (akunList: Akun[], b: Bulan) => akunList.reduce((s, a) => s + val(a.kode, b), 0);
  const groupTotal = (akunList: Akun[]) => months.reduce((s, b) => s + groupSubtotal(akunList, b), 0);

  const tampilkan = () => {
    const a = parseMonth(mulai);
    const b = parseMonth(hingga);
    if (!a || !b) {
      setSetupError("Isi bulan mulai dan bulan hingga terlebih dahulu");
      return;
    }
    const diff = (b.tahun - a.tahun) * 12 + (b.bulan - a.bulan);
    if (diff < 0) {
      setSetupError("Anggaran hingga tidak boleh lebih awal dari anggaran dimulai");
      return;
    }
    if (diff > 5) {
      setSetupError("Periode anggaran maksimal 6 bulan");
      return;
    }
    setSetupError("");
    setMonths(monthsBetween(a, b));
    setEditingId(null);
    setValues({});
    setTableError("");
    setMode("tabel");
  };

  const bukaBudget = async (id: string) => {
    setLoadingDetail(true);
    setTableError("");
    try {
      const res = await fetch(`/api/keuangan/anggaran-laba-rugi/${id}`, { credentials: "include" });
      const j = await res.json();
      if (!j?.success) throw new Error(j?.message || "Gagal membuka anggaran");
      const d = j.data as {
        nama: string;
        tahunMulai: number;
        bulanMulai: number;
        durasi: number;
        items: { kodeAkun: string; tahun: number; bulan: number; nominal: number }[];
      };
      const ms: Bulan[] = [];
      for (let i = 0; i < d.durasi; i++) {
        const idx = d.bulanMulai - 1 + i;
        ms.push({ tahun: d.tahunMulai + Math.floor(idx / 12), bulan: (idx % 12) + 1 });
      }
      const v: Record<string, number> = {};
      for (const it of d.items) v[`${it.kodeAkun}|${ymKey(it.tahun, it.bulan)}`] = Number(it.nominal);
      setNama(d.nama);
      setMonths(ms);
      setValues(v);
      setEditingId(id);
      setModalOpen(false);
      setMode("tabel");
    } catch (e) {
      setTableError(e instanceof Error ? e.message : "Gagal membuka anggaran");
      setMode("tabel");
    } finally {
      setLoadingDetail(false);
    }
  };

  const simpan = async () => {
    if (months.length === 0) return;
    setSaving(true);
    setTableError("");
    try {
      const items = Object.entries(values)
        .filter(([, n]) => n > 0)
        .map(([key, nominal]) => {
          const [kodeAkun, ym] = key.split("|");
          const t = parseMonth(ym);
          return { kodeAkun, tahun: t?.tahun ?? 0, bulan: t?.bulan ?? 0, nominal: Math.round(nominal) };
        });
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/keuangan/anggaran-laba-rugi/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ nama: nama.trim() || undefined, items }),
        });
      } else {
        const first = months[0];
        res = await fetch("/api/keuangan/anggaran-laba-rugi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            nama: nama.trim() || `Anggaran ${labelBulan(first)}`,
            tahunMulai: first.tahun,
            bulanMulai: first.bulan,
            durasi: months.length,
            items,
          }),
        });
      }
      const j = await res.json();
      if (!j?.success) throw new Error(j?.message || "Gagal menyimpan anggaran");
      const kembaliKe = editingId ?? null;
      setReloadKey((k) => k + 1);
      if (kembaliKe) {
        bukaMonitor(kembaliKe);
      } else {
        setModalOpen(false);
        setMode("memilih");
      }
    } catch (e) {
      setTableError(e instanceof Error ? e.message : "Gagal menyimpan anggaran");
    } finally {
      setSaving(false);
    }
  };

  const hapus = async (id: string, label: string) => {
    if (!window.confirm(`Hapus anggaran "${label}"?`)) return;
    try {
      const res = await fetch(`/api/keuangan/anggaran-laba-rugi/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await res.json();
      if (!j?.success) throw new Error(j?.message || "Gagal menghapus anggaran");
      setReloadKey((k) => k + 1);
      setAnggaranId(null);
      setApplied(null);
      setSnap(null);
      router.push(pathname, { scroll: false });
      setMode("memilih");
    } catch (e) {
      setMonError(e instanceof Error ? e.message : "Gagal menghapus anggaran");
    }
  };

  const terapkanFilter = () => {
    if (!parseMonth(draft.berakhirPada)) {
      setFilterError("Isi tanggal berakhir anggaran terlebih dahulu");
      return;
    }
    setFilterError("");
    setApplied(draft);
  };

  const download = async (fmt: "pdf" | "xlsx") => {
    if (!anggaranId || !applied) return;
    setDl(fmt);
    setMenuUnduh(false);
    try {
      const res = await fetch(`/api/keuangan/laporan/anggaran-laba-rugi?${queryMonitor()}&format=${fmt}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || "Gagal mengunduh file");
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = m?.[1] ?? `anggaran-laba-rugi.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMonError(e instanceof Error ? e.message : "Gagal mengunduh file");
    } finally {
      setDl(null);
    }
  };

  const toggleSection = (key: string) => setExpanded((v) => ({ ...v, [key]: !v[key] }));

  // ------------------------- TAMPILAN MONITOR -------------------------
  if (mode === "monitor") {
    const n = snap?.kolom.length ?? 0;
    return (
      <div className="space-y-5">
        <ModalPilihAnggaran
          open={modalOpen}
          budgets={budgets}
          loading={budgets === null}
          error={listError}
          pilih={modalPilih}
          setPilih={setModalPilih}
          onBatal={() => {
            setModalOpen(false);
            router.push("/keuangan/laporan");
          }}
          onLanjut={() => {
            if (modalPilih) bukaMonitor(modalPilih);
          }}
          onBuatBaru={() => {
            setModalOpen(false);
            setNama("");
            setMulai("");
            setHingga("");
            setSetupError("");
            setMode("setup");
          }}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setModalOpen(true)} className="w-fit cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
            Pilih anggaran
          </Button>
          <div className="relative">
            <Button
              type="button"
              onClick={() => setMenuUnduh((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuUnduh}
              disabled={!snap}
              className="cursor-pointer bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download / Ekspor
              <ChevronDown className="h-4 w-4" />
            </Button>
            {menuUnduh && (
              <>
                <button
                  type="button"
                  aria-label="Tutup menu unduhan"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setMenuUnduh(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={dl !== null}
                    onClick={() => download("pdf")}
                    className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4 text-slate-400" />
                    {dl === "pdf" ? "Menyiapkan PDF..." : "Download PDF"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={dl !== null}
                    onClick={() => download("xlsx")}
                    className="flex w-full cursor-pointer items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                    {dl === "xlsx" ? "Menyiapkan XLSX..." : "Download XLSX"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {monError && <p className="text-center text-sm text-red-600">{monError}</p>}

        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-sm">Filter Laporan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label htmlFor="mon-berakhir" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Anggaran berakhir pada
                </label>
                <Input
                  id="mon-berakhir"
                  type="month"
                  value={draft.berakhirPada}
                  onChange={(e) => setDraft((d) => ({ ...d, berakhirPada: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <label htmlFor="mon-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Anggaran dari
                </label>
                <Select
                  id="mon-dari"
                  value={String(draft.lihatBalik)}
                  onChange={(e) => setDraft((d) => ({ ...d, lihatBalik: Number(e.target.value) as MonitorLihatBalik }))}
                  aria-label="Anggaran dari"
                >
                  {MONITOR_LIHAT_BALIK.map((v) => (
                    <option key={v} value={v}>
                      {v} bulan ke belakang
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="mon-setiap" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Tampilkan setiap
                </label>
                <Select
                  id="mon-setiap"
                  value={String(draft.tampilSetiap)}
                  onChange={(e) => setDraft((d) => ({ ...d, tampilSetiap: Number(e.target.value) as MonitorTampilSetiap }))}
                  aria-label="Tampilkan setiap"
                >
                  {MONITOR_TAMPIL_SETIAP.map((v) => (
                    <option key={v} value={v}>
                      {v} bulan
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="mon-template" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Template laba rugi
                </label>
                <Select
                  id="mon-template"
                  value={draft.template}
                  onChange={(e) => setDraft((d) => ({ ...d, template: e.target.value as MonitorTemplate }))}
                  aria-label="Template laba rugi"
                >
                  {MONITOR_TEMPLATE.map((v) => (
                    <option key={v} value={v}>
                      {MONITOR_TEMPLATE_LABEL[v]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={terapkanFilter}
                  className="w-full cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  Tampilkan
                </Button>
              </div>
            </div>
            {filterError && <p className="text-xs text-red-600">{filterError}</p>}
          </CardContent>
        </Card>

        {monLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Menyusun laporan anggaran vs aktual...</p>
        ) : snap ? (
          <Card className="border-slate-200">
            <CardContent className="p-5 sm:p-6">
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
                  <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
                  <p className="text-sm font-semibold text-slate-900">Anggaran laba rugi: {snap.anggaranNama}</p>
                  <p className="text-xs text-slate-500">{snap.label}</p>
                  <p className="text-xs text-slate-400">(dalam IDR)</p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead rowSpan={2} className="min-w-56 align-bottom text-xs">
                          Uraian
                        </TableHead>
                        {snap.kolom.map((k) => (
                          <TableHead key={k.label} colSpan={2} className="border-l border-slate-200 text-center text-xs">
                            {k.label}
                          </TableHead>
                        ))}
                        <TableHead colSpan={2} className="border-l border-slate-200 text-center text-xs">
                          Total
                        </TableHead>
                      </TableRow>
                      <TableRow className="bg-slate-50">
                        {snap.kolom.map((k) => (
                          <Fragment key={k.label}>
                            <TableHead className="border-l border-slate-200 text-right text-xs">Anggaran</TableHead>
                            <TableHead className="text-right text-xs">Aktual</TableHead>
                          </Fragment>
                        ))}
                        <TableHead className="border-l border-slate-200 text-right text-xs">Anggaran</TableHead>
                        <TableHead className="text-right text-xs">Aktual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SectionRows
                        judul="Revenue"
                        section={snap.revenue}
                        n={n}
                        open={!!expanded.revenue}
                        onToggle={() => toggleSection("revenue")}
                      />
                      <SectionRows
                        judul="Cost of Sales"
                        section={snap.cos}
                        n={n}
                        open={!!expanded.cos}
                        onToggle={() => toggleSection("cos")}
                      />
                      <ProfitRow judul="Gross Profit" anggaran={snap.grossProfit.anggaran} aktual={snap.grossProfit.aktual} n={n} highlight />
                      <SectionRows
                        judul="Operational Expense"
                        section={snap.opex}
                        n={n}
                        open={!!expanded.opex}
                        onToggle={() => toggleSection("opex")}
                      />
                      <ProfitRow judul="Operating Profit" anggaran={snap.operatingProfit.anggaran} aktual={snap.operatingProfit.aktual} n={n} highlight />
                      <SectionRows
                        judul="Other Income"
                        section={snap.otherIncome}
                        n={n}
                        open={!!expanded.otherIncome}
                        onToggle={() => toggleSection("otherIncome")}
                      />
                      <SectionRows
                        judul="Other Expense"
                        section={snap.otherExpense}
                        n={n}
                        open={!!expanded.otherExpense}
                        onToggle={() => toggleSection("otherExpense")}
                      />
                      <ProfitRow judul="Total dari Other Income (Expense)" anggaran={snap.otherTotal.anggaran} aktual={snap.otherTotal.aktual} n={n} />
                      <ProfitRow judul="Profit (Loss)" anggaran={snap.profit.anggaran} aktual={snap.profit.aktual} n={n} grand />
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => bukaBudget(snap.anggaranId)} disabled={loadingDetail} className="cursor-pointer">
                    <Pencil className="h-3.5 w-3.5" />
                    {loadingDetail ? "Membuka..." : "Ubah anggaran"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => hapus(snap.anggaranId, snap.anggaranNama)} className="cursor-pointer text-red-600 hover:text-red-700">
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                </div>

                {snap.catatan.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold text-amber-800">Catatan</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-amber-800">
                      {snap.catatan.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          !monError && <p className="py-10 text-center text-sm text-slate-400">Pilih anggaran lalu tekan Tampilkan.</p>
        )}

        <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <Download className="h-3.5 w-3.5 shrink-0" />
          Detail, PDF, dan XLSX memakai sumber data monitor yang sama sehingga angkanya identik.
        </p>
      </div>
    );
  }

  // ------------------------- TAMPILAN TABEL (input anggaran, dipertahankan) -------------------------
  if (mode === "tabel") {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTableError("");
              setSetupError("");
              if (editingId) bukaMonitor(editingId);
              else setMode("setup");
            }}
            className="w-fit cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Batal
          </Button>
          <Button
            type="button"
            onClick={simpan}
            disabled={saving}
            className="w-fit cursor-pointer bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan"}
          </Button>
        </div>

        {tableError && <p className="text-center text-sm text-red-600">{tableError}</p>}

        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-sm">
              {editingId ? nama : nama || `Anggaran ${months.length > 0 ? labelBulan(months[0]) : ""}`}
              {months.length > 0 && (
                <span className="ml-2 font-normal text-slate-500">
                  {labelBulan(months[0])} – {labelBulan(months[months.length - 1])}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {!editingId && (
              <div className="sm:w-80">
                <label htmlFor="anggaran-nama" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Nama anggaran
                </label>
                <Input
                  id="anggaran-nama"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder={`Anggaran ${months.length > 0 ? labelBulan(months[0]) : ""}`}
                  className="h-10 text-sm"
                />
              </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="min-w-56 text-xs">Akun</TableHead>
                    {months.map((b) => (
                      <TableHead key={ymKey(b.tahun, b.bulan)} className="min-w-36 text-right text-xs">
                        {labelBulanSingkat(b)}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-36 text-right text-xs">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-slate-50/70">
                    <TableCell colSpan={months.length + 2} className="text-xs font-semibold text-slate-900">
                      Pendapatan (Revenue)
                    </TableCell>
                  </TableRow>
                  {groups.pend.map((g) => (
                    <Fragment key={`pend-${g.golongan}`}>
                      <TableRow>
                        <TableCell colSpan={months.length + 2} className="py-2 text-[11px] font-medium text-slate-500">
                          {g.golongan}
                        </TableCell>
                      </TableRow>
                      {g.akun.map((a) => (
                        <TableRow key={a.kode}>
                          <TableCell className="text-xs text-slate-700">
                            <span className="font-mono text-[11px] text-slate-400">{a.kode}</span>
                            <span className="mx-1.5 text-slate-300">·</span>
                            {a.nama}
                          </TableCell>
                          {months.map((b) => (
                            <TableCell key={ymKey(b.tahun, b.bulan)} className="p-1.5">
                              <Input
                                type="number"
                                min={0}
                                value={val(a.kode, b) || ""}
                                onChange={(e) => {
                                  const n2 = Number(e.target.value);
                                  const k = `${a.kode}|${ymKey(b.tahun, b.bulan)}`;
                                  setValues((v) => ({ ...v, [k]: Number.isFinite(n2) && n2 > 0 ? n2 : 0 }));
                                }}
                                placeholder="0"
                                className="h-9 text-right text-xs tabular-nums"
                                aria-label={`${a.nama} ${labelBulan(b)}`}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-right text-xs font-medium tabular-nums text-slate-900">
                            {rp(months.reduce((s, b) => s + val(a.kode, b), 0))}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow key={`t-${g.golongan}`} className="bg-slate-50/50">
                        <TableCell className="text-xs font-medium text-slate-700">Total {g.golongan}</TableCell>
                        {months.map((b) => (
                          <TableCell key={ymKey(b.tahun, b.bulan)} className="text-right text-xs font-medium tabular-nums text-slate-700">
                            {rp(groupSubtotal(g.akun, b))}
                          </TableCell>
                        ))}
                        <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                          {rp(groupTotal(g.akun))}
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  ))}
                  <TableRow className="bg-slate-50/70">
                    <TableCell className="text-xs font-semibold text-slate-900">Total Pendapatan</TableCell>
                    {totals.perBulan.map((t, i) => (
                      <TableCell key={months[i] ? ymKey(months[i].tahun, months[i].bulan) : i} className="text-right text-xs font-semibold tabular-nums text-slate-900">
                        {rp(t.pend)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                      {rp(totals.totalPend)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="bg-slate-50/70">
                    <TableCell colSpan={months.length + 2} className="text-xs font-semibold text-slate-900">
                      Beban (Expense / Cost)
                    </TableCell>
                  </TableRow>
                  {groups.beban.map((g) => (
                    <Fragment key={`beban-${g.golongan}`}>
                      <TableRow>
                        <TableCell colSpan={months.length + 2} className="py-2 text-[11px] font-medium text-slate-500">
                          {g.golongan}
                        </TableCell>
                      </TableRow>
                      {g.akun.map((a) => (
                        <TableRow key={a.kode}>
                          <TableCell className="text-xs text-slate-700">
                            <span className="font-mono text-[11px] text-slate-400">{a.kode}</span>
                            <span className="mx-1.5 text-slate-300">·</span>
                            {a.nama}
                          </TableCell>
                          {months.map((b) => (
                            <TableCell key={ymKey(b.tahun, b.bulan)} className="p-1.5">
                              <Input
                                type="number"
                                min={0}
                                value={val(a.kode, b) || ""}
                                onChange={(e) => {
                                  const n2 = Number(e.target.value);
                                  const k = `${a.kode}|${ymKey(b.tahun, b.bulan)}`;
                                  setValues((v) => ({ ...v, [k]: Number.isFinite(n2) && n2 > 0 ? n2 : 0 }));
                                }}
                                placeholder="0"
                                className="h-9 text-right text-xs tabular-nums"
                                aria-label={`${a.nama} ${labelBulan(b)}`}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-right text-xs font-medium tabular-nums text-slate-900">
                            {rp(months.reduce((s, b) => s + val(a.kode, b), 0))}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow key={`t-${g.golongan}`} className="bg-slate-50/50">
                        <TableCell className="text-xs font-medium text-slate-700">Total {g.golongan}</TableCell>
                        {months.map((b) => (
                          <TableCell key={ymKey(b.tahun, b.bulan)} className="text-right text-xs font-medium tabular-nums text-slate-700">
                            {rp(groupSubtotal(g.akun, b))}
                          </TableCell>
                        ))}
                        <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                          {rp(groupTotal(g.akun))}
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  ))}
                  <TableRow className="bg-slate-50/70">
                    <TableCell className="text-xs font-semibold text-slate-900">Total Beban</TableCell>
                    {totals.perBulan.map((t, i) => (
                      <TableCell key={months[i] ? ymKey(months[i].tahun, months[i].bulan) : i} className="text-right text-xs font-semibold tabular-nums text-slate-900">
                        {rp(t.beban)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                      {rp(totals.totalBeban)}
                    </TableCell>
                  </TableRow>

                  <TableRow className="bg-emerald-700">
                    <TableCell className="text-xs font-semibold text-white">Profit (Loss)</TableCell>
                    {totals.perBulan.map((t, i) => (
                      <TableCell
                        key={months[i] ? ymKey(months[i].tahun, months[i].bulan) : i}
                        className="text-right text-xs font-semibold tabular-nums text-white"
                      >
                        {rp(t.profit)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-xs font-semibold tabular-nums text-white">
                      {rp(totals.totalProfit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Profit (Loss) = Total Pendapatan − Total Beban, dihitung otomatis dari nominal yang diinput.
              Akun 4105 (Penerimaan Piutang) tidak termasuk karena bukan pendapatan.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ------------------------- FORM PERIODE (buat anggaran, dipertahankan) -------------------------
  if (mode === "setup") {
    return (
      <div className="space-y-5">
        {(budgets !== null && budgets.length > 0) || anggaranId ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (budgets && budgets.length > 0) {
                setModalPilih((v) => v || budgets[0].id);
                setModalOpen(true);
              }
              setMode("memilih");
            }}
            className="w-fit cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
        ) : null}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-sm">Buat Anggaran Laba Rugi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <p className="text-xs leading-relaxed text-slate-500">
              Tentukan periode terlebih dahulu, lalu klik Tampilkan untuk mengisi nominal per akun per bulan.
            </p>
            <div className="sm:w-80">
              <label htmlFor="anggaran-nama-baru" className="mb-1.5 block text-xs font-medium text-slate-600">
                Nama anggaran
              </label>
              <Input
                id="anggaran-nama-baru"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="cth: Anggaran Semester 1"
                className="h-10 text-sm"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <label htmlFor="anggaran-mulai" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Anggaran dimulai pada
                </label>
                <Input
                  id="anggaran-mulai"
                  type="month"
                  value={mulai}
                  onChange={(e) => {
                    setMulai(e.target.value);
                    setSetupError("");
                  }}
                  className="h-10 text-sm"
                />
              </div>
              <span className="pb-3 text-slate-400">–</span>
              <div>
                <label htmlFor="anggaran-hingga" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Anggaran hingga
                </label>
                <Input
                  id="anggaran-hingga"
                  type="month"
                  value={hingga}
                  onChange={(e) => {
                    setHingga(e.target.value);
                    setSetupError("");
                  }}
                  className="h-10 text-sm"
                />
              </div>
              <Button
                type="button"
                onClick={tampilkan}
                className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800 sm:w-auto"
              >
                Tampilkan
              </Button>
            </div>
            {setupError && <p className="text-xs text-red-600">{setupError}</p>}
            <p className="text-[11px] leading-relaxed text-slate-400">Periode anggaran maksimal 6 bulan.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ------------------------- MEMILIH (modal) -------------------------
  return (
    <div className="space-y-5">
      <ModalPilihAnggaran
        open={modalOpen || budgets === null || (budgets.length > 0 && !anggaranId)}
        budgets={budgets}
        loading={budgets === null}
        error={listError}
        pilih={modalPilih}
        setPilih={setModalPilih}
        onBatal={() => {
          setModalOpen(false);
          router.push("/keuangan/laporan");
        }}
        onLanjut={() => {
          if (modalPilih) bukaMonitor(modalPilih);
        }}
        onBuatBaru={() => {
          setModalOpen(false);
          setNama("");
          setMulai("");
          setHingga("");
          setSetupError("");
          setMode("setup");
        }}
      />
      {budgets !== null && budgets.length === 0 && !listError ? (
        <Card className="border-slate-200">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
              <FileText className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Belum ada anggaran</p>
              <p className="mt-1 text-xs text-slate-500">Buat anggaran laba rugi terlebih dahulu untuk mulai memonitor.</p>
            </div>
            <Button
              type="button"
              onClick={() => {
                setNama("");
                setMulai("");
                setHingga("");
                setSetupError("");
                setMode("setup");
              }}
              className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
            >
              <Plus className="h-4 w-4" />
              Buat Anggaran
            </Button>
          </CardContent>
        </Card>
      ) : (
        <p className="py-10 text-center text-sm text-slate-400">
          {listError || "Memuat daftar anggaran..."}
        </p>
      )}
    </div>
  );
}

// ------------------------- MODAL PILIH ANGGARAN -------------------------

function ModalPilihAnggaran({
  open,
  budgets,
  loading,
  error,
  pilih,
  setPilih,
  onBatal,
  onLanjut,
  onBuatBaru,
}: {
  open: boolean;
  budgets: BudgetRow[] | null;
  loading: boolean;
  error: string;
  pilih: string;
  setPilih: (v: string) => void;
  onBatal: () => void;
  onLanjut: () => void;
  onBuatBaru: () => void;
}) {
  if (!open) return null;
  const labelBudget = (b: BudgetRow) =>
    `${b.nama} — ${labelBulan({ tahun: b.tahunMulai, bulan: b.bulanMulai })} · ${b.durasi} bulan`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-anggaran-judul">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="modal-anggaran-judul" className="text-sm font-semibold text-slate-900">
            Pilih anggaran yang ingin dimonitor
          </h2>
          <button type="button" onClick={onBatal} aria-label="Tutup" className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="py-4 text-center text-xs text-slate-400">Memuat daftar anggaran...</p>
          ) : error ? (
            <p className="py-4 text-center text-xs text-red-600">{error}</p>
          ) : budgets && budgets.length > 0 ? (
            <>
              <div>
                <label htmlFor="modal-anggaran" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Daftar anggaran
                </label>
                <Select id="modal-anggaran" value={pilih} onChange={(e) => setPilih(e.target.value)} aria-label="Daftar anggaran">
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {labelBudget(b)}
                    </option>
                  ))}
                </Select>
              </div>
              <button type="button" onClick={onBuatBaru} className="cursor-pointer text-xs font-medium text-emerald-700 hover:text-emerald-800">
                + Buat anggaran baru
              </button>
            </>
          ) : (
            <p className="py-4 text-center text-xs text-slate-400">Belum ada anggaran tersimpan.</p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onBatal} className="cursor-pointer">
            Batalkan
          </Button>
          <Button
            type="button"
            onClick={onLanjut}
            disabled={!pilih || loading}
            className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            Lanjutkan
          </Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------- BARIS SECTION & PROFIT (monitor) -------------------------

function NilaiSel({ v, bold }: { v: number; bold?: boolean }) {
  const cls = `text-right text-xs tabular-nums ${bold ? "font-semibold text-slate-900" : "text-slate-700"}`;
  return <TableCell className={cls}>{v !== 0 ? rp(v) : <span className="text-slate-300">—</span>}</TableCell>;
}

function SectionRows({
  judul,
  section,
  n,
  open,
  onToggle,
}: {
  judul: string;
  section: MonitorSnapshot["revenue"];
  n: number;
  open: boolean;
  onToggle: () => void;
}) {
  const totalA = section.totalAnggaran.reduce((s, v) => s + v, 0);
  const totalK = section.totalAktual.reduce((s, v) => s + v, 0);
  return (
    <>
      <TableRow className="bg-slate-100/70">
        <TableCell colSpan={2 * n + 3}>
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex cursor-pointer items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-700">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {judul}
          </button>
        </TableCell>
      </TableRow>
      {open &&
        section.akun.map((a) => (
          <TableRow key={`${a.kode}|${a.nama}`}>
            <TableCell className="pl-6 text-xs text-slate-700">
              {a.kode !== "—" ? (
                <>
                  <span className="font-mono text-[11px] text-slate-400">{a.kode}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                </>
              ) : null}
              {a.nama}
            </TableCell>
            {a.anggaran.map((v, i) => (
              <Fragment key={i}>
                <NilaiSel v={v} />
                <NilaiSel v={a.aktual[i] ?? 0} />
              </Fragment>
            ))}
            <NilaiSel v={a.anggaran.reduce((s, v) => s + v, 0)} bold />
            <NilaiSel v={a.aktual.reduce((s, v) => s + v, 0)} bold />
          </TableRow>
        ))}
      <TableRow className="bg-slate-50/70">
        <TableCell className="text-xs font-semibold text-slate-900">Total dari {judul}</TableCell>
        {section.totalAnggaran.map((v, i) => (
          <Fragment key={i}>
            <NilaiSel v={v} bold />
            <NilaiSel v={section.totalAktual[i] ?? 0} bold />
          </Fragment>
        ))}
        <NilaiSel v={totalA} bold />
        <NilaiSel v={totalK} bold />
      </TableRow>
    </>
  );
}

function ProfitRow({
  judul,
  anggaran,
  aktual,
  n,
  highlight,
  grand,
}: {
  judul: string;
  anggaran: number[];
  aktual: number[];
  n: number;
  highlight?: boolean;
  grand?: boolean;
}) {
  void n;
  const cls = grand ? "bg-emerald-700" : highlight ? "bg-emerald-50/60" : "";
  const txt = grand ? "text-white" : "text-emerald-900";
  return (
    <TableRow className={cls}>
      <TableCell className={`text-xs font-semibold ${txt}`}>{judul}</TableCell>
      {anggaran.map((v, i) => (
        <Fragment key={i}>
          <TableCell className={`text-right text-xs font-semibold tabular-nums ${txt}`}>{rp(v)}</TableCell>
          <TableCell className={`text-right text-xs font-semibold tabular-nums ${txt}`}>{rp(aktual[i] ?? 0)}</TableCell>
        </Fragment>
      ))}
      <TableCell className={`text-right text-xs font-semibold tabular-nums ${txt}`}>
        {rp(anggaran.reduce((s, v) => s + v, 0))}
      </TableCell>
      <TableCell className={`text-right text-xs font-semibold tabular-nums ${txt}`}>
        {rp(aktual.reduce((s, v) => s + v, 0))}
      </TableCell>
    </TableRow>
  );
}
