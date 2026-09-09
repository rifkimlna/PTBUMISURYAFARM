import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function AsetPage() {
  const aset = await prisma.aset.findMany({ orderBy: { createdAt: "desc" } });
  const total = aset.reduce((s, a) => s + Number(a.nilaiAset) * a.jumlah, 0);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Inventaris Aset</h1>
        <div className="text-sm text-slate-500">
          Total Nilai: <span className="font-bold text-slate-900">Rp {total.toLocaleString("id-ID")}</span>
        </div>
      </div>
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">Daftar Alat / Traktor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Kondisi</TableHead>
                <TableHead>Nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aset.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.id}</TableCell>
                  <TableCell>{a.namaAset}</TableCell>
                  <TableCell>{a.jumlah}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{a.kondisi}</Badge>
                  </TableCell>
                  <TableCell>Rp {Number(a.nilaiAset).toLocaleString("id-ID")}</TableCell>
                </TableRow>
              ))}
              {aset.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    Belum ada aset
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
