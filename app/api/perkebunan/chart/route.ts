import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

const querySchema = z.object({
  type: z.enum(["status", "blok", "jenis", "trend"]).default("status"),
  periode: z.enum(["7-hari", "bulan-ini", "6-bulan", "1-tahun"]).default("6-bulan"),
});

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function formatDayKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function formatMonthKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

// GET /api/perkebunan/chart?type=status|blok|jenis|trend&periode=6-bulan
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      type: searchParams.get("type") ?? "status",
      periode: searchParams.get("periode") ?? "6-bulan",
    });
    if (!parsed.success) return errorResponse("Query tidak valid", 400);
    const { type, periode } = parsed.data;

    // Status donut - count per status
    if (type === "status") {
      const groups = await prisma.pohon.groupBy({
        by: ["status"],
        _count: { status: true },
      });
      const total = groups.reduce((s, g) => s + g._count.status, 0);
      const items = groups.map((g) => ({
        key: g.status,
        label: g.status,
        value: g._count.status,
        total,
      }));
      // Ensure all 4 status appear even if 0
      const allStatus = ["SEHAT", "PERLU_PERHATIAN", "SAKIT", "MATI"] as const;
      for (const s of allStatus) {
        if (!items.find((i) => i.key === s)) items.push({ key: s, label: s, value: 0, total });
      }
      return successResponse({ type, items });
    }

    // Blok bar - sum hasilPanen per lokasiBlok
    if (type === "blok") {
      const rows = await prisma.pohon.groupBy({
        by: ["lokasiBlok"],
        _sum: { hasilPanen: true },
        _count: { lokasiBlok: true },
      });
      const items = rows
        .map((r) => ({
          key: r.lokasiBlok,
          label: r.lokasiBlok,
          value: Number(r._sum.hasilPanen ?? 0),
          count: r._count.lokasiBlok,
        }))
        .sort((a, b) => b.value - a.value);
      return successResponse({ type, items });
    }

    // Jenis bar - sum hasilPanen per jenis
    if (type === "jenis") {
      const rows = await prisma.pohon.groupBy({
        by: ["jenis"],
        _sum: { hasilPanen: true },
        _count: { jenis: true },
      });
      const items = rows
        .map((r) => ({
          key: r.jenis ?? "Tidak Diketahui",
          label: r.jenis ?? "Tidak Diketahui",
          value: Number(r._sum.hasilPanen ?? 0),
          count: r._count.jenis,
        }))
        .sort((a, b) => b.value - a.value);
      return successResponse({ type, items });
    }

    // Trend - sum Panen.jumlahKg per periode (fallback to Pohon.hasilPanen if Panen empty)
    // Use Panen table if exists
    const now = startOfDay(new Date());
    const latestPanen = await prisma.panen.findFirst({ orderBy: { tanggalPanen: "desc" }, select: { tanggalPanen: true } });
    const latestPohon = await prisma.pohon.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } });
    const refDate = latestPanen ? startOfDay(latestPanen.tanggalPanen) : latestPohon ? startOfDay(latestPohon.updatedAt) : now;
    const today = refDate > now ? refDate : now;

    const buckets: string[] = [];
    let bucketKey: (d: Date) => string = formatMonthKey;
    let granularity: "hari" | "bulan" = "bulan";

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
        const y = today.getFullYear();
        const m = today.getMonth();
        const dim = new Date(y, m + 1, 0).getDate();
        for (let day = 1; day <= dim; day++) buckets.push(formatDayKey(new Date(y, m, day)));
        bucketKey = formatDayKey;
        granularity = "hari";
        break;
      }
      case "6-bulan": {
        for (let i = 5; i >= 0; i--) buckets.push(formatMonthKey(new Date(today.getFullYear(), today.getMonth() - i, 1)));
        bucketKey = formatMonthKey;
        granularity = "bulan";
        break;
      }
      case "1-tahun": {
        for (let i = 11; i >= 0; i--) buckets.push(formatMonthKey(new Date(today.getFullYear(), today.getMonth() - i, 1)));
        bucketKey = formatMonthKey;
        granularity = "bulan";
        break;
      }
    }

    const lastKey = buckets[buckets.length - 1];
    const start =
      buckets[0].length === 10
        ? startOfDay(new Date(buckets[0] + "T00:00:00"))
        : new Date(Number(buckets[0].slice(0, 4)), Number(buckets[0].slice(5, 7)) - 1, 1);
    const end =
      lastKey.length === 10
        ? (() => {
            const d = new Date(lastKey + "T00:00:00");
            d.setHours(23, 59, 59, 999);
            return d;
          })()
        : new Date(Number(lastKey.slice(0, 4)), Number(lastKey.slice(5, 7)), 0, 23, 59, 59, 999);

    // Try Panen first
    const panenRows = await prisma.panen.findMany({
      where: { tanggalPanen: { gte: start, lte: end } },
      select: { jumlahKg: true, tanggalPanen: true },
    });

    const map = new Map<string, { key: string; value: number; count: number }>();
    for (const k of buckets) map.set(k, { key: k, value: 0, count: 0 });

    if (panenRows.length > 0) {
      for (const r of panenRows) {
        const key = bucketKey(r.tanggalPanen);
        const item = map.get(key);
        if (!item) continue;
        item.value += Number(r.jumlahKg);
        item.count += 1;
      }
    } else {
      // Fallback: use Pohon.createdAt as proxy for trend (if no Panen yet)
      const pohonRows = await prisma.pohon.findMany({
        where: { createdAt: { gte: start, lte: end }, hasilPanen: { not: null } },
        select: { hasilPanen: true, createdAt: true },
      });
      for (const r of pohonRows) {
        const key = bucketKey(r.createdAt);
        const item = map.get(key);
        if (!item) continue;
        item.value += Number(r.hasilPanen ?? 0);
        item.count += 1;
      }
    }

    const items = buckets.map((k) => map.get(k)!);
    return successResponse({ type, periode, granularity, items });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil chart perkebunan", 500);
  }
}
