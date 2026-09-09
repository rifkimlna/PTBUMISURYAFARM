"use client";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

export function PrintButton({ label = "Cetak" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  );
}

export function ExportButton() {
  return (
    <Button variant="outline" className="hidden sm:flex" onClick={() => window.print()}>
      <Download className="h-4 w-4" /> Export Excel
    </Button>
  );
}
