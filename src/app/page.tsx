import { redirect } from "next/navigation";

// Raiz apenas encaminha; o middleware decide login vs. área interna.
export default function Home() {
  redirect("/pedidos");
}
