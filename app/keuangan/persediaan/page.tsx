import { redirect } from "next/navigation";

// Persediaan Barang kini menjadi modul Produk. Route lama dialihkan agar
// bookmark/link lama tidak 404; data dan API tidak berubah.
export default function PersediaanRedirect() {
  redirect("/keuangan/produk");
}
