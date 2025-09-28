"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AdminEventForm from "../../_components/AdminEventForm";

export default function CreateEventPage() {
  const router = useRouter();
  const [refresh, setRefresh] = useState(false);

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <h1 className="text-2xl font-bold mb-6">Neues Event erstellen</h1>

      <AdminEventForm
        open={true} // damit resetForm läuft
        onOpenChange={() => router.push("/admin")}
        event={null}
        onSuccess={() => {
          setRefresh(!refresh);
          router.push("/admin");
        }}
      />
    </div>
  );
}
