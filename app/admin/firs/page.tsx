import { redirect } from "next/navigation";

// Der Bereich heißt jetzt „Team & Rechte“ – alte Lesezeichen weiterleiten
export default function LegacyFirsPage() {
  redirect("/admin/team");
}
