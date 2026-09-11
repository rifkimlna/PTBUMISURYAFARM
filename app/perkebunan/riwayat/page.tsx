import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function RiwayatPage() {
  const data = await prisma.riwayatKesehatan.findMany({
    orderBy: { tanggalCek: "desc" },
    take: 30,
    include: { pohon: { select: { id: true, varietas: true } }, petugas: { select: { nama: true } } },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Log Riwayat Kesehatan</h1>
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">30 log terbaru</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pohon</TableHead>
                <TableHead>Gejala</TableHead>
                <TableHead>Petugas</TableHead>
                <TableHead>Foto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.tanggalCek).toLocaleDateString("id-ID")}</TableCell>
                  <TableCell className="font-mono text-xs">{r.pohon.id}</TableCell>
                  <TableCell className="text-sm max-w-[240px] truncate">{r.gejala}</TableCell>
                  <TableCell className="text-xs">{r.petugas.nama}</TableCell>
                  <TableCell>
                    {r.fotoUrl ? (
                      <a href={r.fotoUrl} target="_blank" className="text-xs text-green-800 hover:underline">
                        Lihat
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    Belum ada riwayat
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
