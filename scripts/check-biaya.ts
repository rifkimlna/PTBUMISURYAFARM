import { prisma } from "@/lib/prisma";

async function main() {
  const biaya = await prisma.biaya.findMany({
    orderBy: { tanggal: "desc" },
    take: 20,
    select: {
      id: true, noBiaya: true, tanggal: true, kategori: true, kodeAkun: true,
      penerima: true, status: true, sisa: true, jumlah: true, memo: true,
      transaksiKasId: true, tagihanId: true,
      transaksiKas: { select: { sumberDana: true, tipe: true, tagihanId: true } },
    },
  });
  console.log("Total Biaya records:", biaya.length);
  for (const b of biaya) {
    const tk = b.transaksiKas;
    console.log(
      b.noBiaya + " | " +
      b.tanggal.toISOString().slice(0, 10) + " | " +
      b.kodeAkun + " - " + b.kategori + " | " +
      b.penerima + " | Rp " + b.jumlah + " | " +
      b.status + " | sisa: " + b.sisa + " | tkId: " + b.transaksiKasId +
      " | thId: " + b.tagihanId + " | sumberDana: " + (tk?.sumberDana ?? "-")
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
