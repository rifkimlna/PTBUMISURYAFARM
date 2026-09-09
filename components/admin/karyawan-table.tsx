"use client";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileSpreadsheet } from "lucide-react";

type Row = { id: string; namaLengkap: string; jabatan: string; statusKerja: string; gajiPokok: number; bulanGaji: string; statusGaji: string };

export function KaryawanTable({ data }: { data: Row[] }) {
  const exportCsv = () => {
    const header = ["ID", "Nama", "Jabatan", "Status Kerja", "Gaji Pokok", "Bulan", "Status Gaji"].join(",");
    const rows = data.map((r) => [r.id, `"${r.namaLengkap}"`, r.jabatan, r.statusKerja, r.gajiPokok, r.bulanGaji, r.statusGaji].join(",")).join("\n");
    const csv = header + "\n" + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "karyawan-pt-bst.csv";
    a.click();
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Manajemen Karyawan</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <FileSpreadsheet className="h-3 w-3" /> Export Excel
          </Button>
          <Button size="sm" className="bg-green-700 hover:bg-green-800">
            <Plus className="h-3 w-3" /> Tambah Karyawan
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Status Kerja</TableHead>
              <TableHead>Status Gaji</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-mono text-xs">{k.id}</TableCell>
                <TableCell className="text-sm font-medium">{k.namaLengkap}</TableCell>
                <TableCell className="text-sm">{k.jabatan}</TableCell>
                <TableCell>
                  <Badge variant="outline">{k.statusKerja}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">{k.bulanGaji}</span>
                    <Badge variant={k.statusGaji === "SUDAH_DIBAYAR" ? "sehat" : "perhatian"}>{k.statusGaji}</Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  Belum ada karyawan
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
