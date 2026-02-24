"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import AdminWeeklyForm from "../../_components/AdminWeeklyForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface FIR {
  id: number;
  code: string;
  name: string;
}

interface WeeklyEventConfig {
  id: number;
  firId: number | null;
  fir?: { code: string; name: string };
  name: string;
  weekday: number;
  weeksOn: number;
  weeksOff: number;
  startDate: string;
  airports?: string[];
  startTime?: string;
  endTime?: string;
  description?: string;
  requiresRoster?: boolean;
  staffedStations?: string[];
  signupDeadlineHours?: number;
  enabled: boolean;
}

export default function EditWeeklyPage() {
  const params = useParams();
  const { user, canInFIR, isVATGERLead } = useUser();
  const [config, setConfig] = useState<WeeklyEventConfig | null>(null);
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch FIRs
        const firsRes = await fetch("/api/firs");
        if (firsRes.ok) {
          const firsData = await firsRes.json();
          setFirs(firsData);
        }

        // Fetch config
        const configRes = await fetch(
          `/api/admin/weeklys/${params.id}`
        );
        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
        } else {
          setError("Weekly Event nicht gefunden");
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Fehler beim Laden der Daten");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  // Check permissions
  const canEdit = (): boolean => {
    if (!user || !config) return false;
    if (isVATGERLead()) return true;
    if (!config.fir?.code) return false;
    return canInFIR(config.fir.code, "event.edit");
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl py-8">
        <p className="text-center text-muted-foreground">Lädt...</p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="container mx-auto max-w-5xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Weekly Event nicht gefunden"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!canEdit()) {
    return (
      <div className="container mx-auto max-w-5xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Du hast keine Berechtigung, dieses Weekly Event zu bearbeiten.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-8">
      <AdminWeeklyForm config={config} firs={firs} />
    </div>
  );
}
