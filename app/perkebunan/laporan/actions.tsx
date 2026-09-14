"use client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function ExportCsvButton({ filename, rows }: { filename: string; rows: string[][] }) {
  function unduh() {
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={unduh} className="rounded-full shrink-0">
      <Download className="h-3.5 w-3.5" /> CSV
    </Button>
  );
}
