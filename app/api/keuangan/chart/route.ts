import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

const periodeSchema = z.enum(["7-hari", "bulan-ini", "6-bulan", "1-tahun"]);

type Item = { key: string; pemasukan: number; pengeluaran: number };

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function formatMonthKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${m}`;
}

// GET /api/keuangan/chart?periode=7-hari|bulan-ini|6-bulan|1-tahun
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const parsed = periodeSchema.safeParse(searchParams.get("periode") ?? "bulan-ini");
    if (!parsed.success) return errorResponse("Periode tidak valid", 400);
    const periode = parsed.data;

    const now = startOfDay(new Date());
    const latest = await prisma.transaksiKas.findFirst({
      orderBy: { tanggal: "desc" },
      select: { tanggal: true },
    });
    const latestDate = latest ? startOfDay(latest.tanggal) : now;
    const today = latestDate > now ? latestDate : now;
    const buckets: string[] = [];
    let bucketKey: (d: Date) => string = formatDayKey;
    let granularity: "hari" | "bulan" = "hari";

    switch (periode) {
      case "7-hari": {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
          buckets.push(formatDayKey(d));
        }
        bucketKey = formatDayKey;
        granularity = "hari";
        break;
      }
      case "bulan-ini": {
        const year = today.getFullYear();
        const month = today.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          buckets.push(formatDayKey(new Date(year, month, day)));
        }
        bucketKey = formatDayKey;
        granularity = "hari";
        break;
      }
      case "6-bulan": {
        const year = today.getFullYear();
        const month = today.getMonth();
        for (let i = 5; i >= 0; i--) {
          buckets.push(formatMonthKey(new Date(year, month - i, 1)));
        }
        bucketKey = formatMonthKey;
        granularity = "bulan";
        break;
      }
      case "1-tahun": {
        const year = today.getFullYear();
        const month = today.getMonth();
        for (let i = 11; i >= 0; i--) {
          buckets.push(formatMonthKey(new Date(year, month - i, 1)));
        }
        bucketKey = formatMonthKey;
        granularity = "bulan";
        break;
      }
    }

    const lastKey = buckets[buckets.length - 1];
    const start = buckets[0].length === 10 ? startOfDay(new Date(buckets[0] + "T00:00:00")) : new Date(Number(buckets[0].slice(0, 4)), Number(buckets[0].slice(5, 7)) - 1, 1);
    const end =
      lastKey.length === 10
        ? (() => {
            const d = new Date(lastKey + "T00:00:00");
            d.setHours(23, 59, 59, 999);
            return d;
          })()
        : new Date(Number(lastKey.slice(0, 4)), Number(lastKey.slice(5, 7)), 0, 23, 59, 59, 999);

    const transaksi = await prisma.transaksiKas.findMany({
      where: { tanggal: { gte: start, lte: end } },
      select: { tipe: true, jumlah: true, tanggal: true },
    });

    const map = new Map<string, Item>();
    for (const key of buckets) {
      map.set(key, { key, pemasukan: 0, pengeluaran: 0 });
    }

    for (const t of transaksi) {
      const key = bucketKey(t.tanggal);
      const item = map.get(key);
      if (!item) continue;
      const jumlah = Number(t.jumlah);
      if (t.tipe === "PEMASUKAN") item.pemasukan += jumlah;
      else item.pengeluaran += jumlah;
    }

    const items = buckets.map((key) => map.get(key)!);

    return successResponse({ periode, granularity, items });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil data grafik", 500);
  }
}