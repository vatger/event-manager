"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { useUserSettings } from "@/lib/stores/userSettingsStore";

export default function EmailNotificationToggle() {
  const { emailNotificationsEnabled, setEmailNotifications } = useUserSettings();
  const [loading, setLoading] = useState(emailNotificationsEnabled === null);

  useEffect(() => {
    if (emailNotificationsEnabled !== null) return; // schon geladen
    fetch("/api/notifications/email")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.emailNotificationsEnabled === "boolean") {
          setEmailNotifications(data.emailNotificationsEnabled);
        }
      })
      .catch(() => toast.error("Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, [emailNotificationsEnabled, setEmailNotifications]);

  const handleToggle = async (value: boolean) => {
    setEmailNotifications(value);
    try {
      const res = await fetch("/api/user/notifications/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotificationsEnabled: value }),
      });

      if (!res.ok) throw new Error();
      toast.success("Einstellung gespeichert");
    } catch {
      toast.error("Fehler beim Speichern");
    }
  };

  if (emailNotificationsEnabled === null) return null; // Noch nicht geladen

  return (
    <div className="flex items-center gap-4">
      <Settings className="w-5 h-5 text-muted-foreground" />
      <Label htmlFor="email-toggle">E-Mail-Benachrichtigungen</Label>
      <Switch
        id="email-toggle"
        checked={emailNotificationsEnabled}
        onCheckedChange={handleToggle}
        disabled={loading}
      />
    </div>
  );
}
