import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FCFCFD] text-slate-900 antialiased selection:bg-slate-900 selection:text-white overflow-x-hidden">
      <PublicNavbar />
      <main className="overflow-x-hidden">{children}</main>
      <PublicFooter />
    </div>
  );
}
