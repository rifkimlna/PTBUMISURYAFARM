import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900", {
  variants: {
    variant: {
      default: "border-transparent bg-slate-900 text-white",
      secondary: "border-slate-100 bg-slate-50 text-slate-600",
      destructive: "border-transparent bg-red-500 text-white",
      outline: "text-slate-600 border-slate-200 bg-white",
      sehat: "border-transparent bg-green-50 text-green-800 ring-1 ring-green-200",
      perhatian: "border-transparent bg-amber-50 text-amber-700 ring-1 ring-amber-100",
      sakit: "border-transparent bg-red-50 text-red-700 ring-1 ring-red-100",
      mati: "border-transparent bg-slate-900 text-white",
      success: "border-transparent bg-green-700 text-white",
      warning: "border-transparent bg-amber-400 text-white",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
