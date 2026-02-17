"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import AdminWeeklyForm from "../_components/AdminWeeklyForm";

interface FIR {
  id: number;
  code: string;
  name: string;
}

export default function CreateWeeklyPage() {
  const { user, canInOwnFIR, isVATGERLead } = useUser();
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFirs = async () => {
      try {
        const res = await fetch("/api/firs");
        if (res.ok) {
          const data = await res.json();
          setFirs(data);
        }
      } catch (err) {
        console.error("Error fetching FIRs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFirs();
  }, []);

  if (
    !user ||
    (!user.fir && !isVATGERLead()) ||
    (!isVATGERLead() && !canInOwnFIR("event.create"))
  ) {
    return (
      <div className="container mx-auto max-w-5xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Du hast keine Berechtigung, Weekly Events zu erstellen.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl py-8">
        <p className="text-center text-muted-foreground">Lädt...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-8">
      <AdminWeeklyForm firs={firs} />
    </div>
  );
}
