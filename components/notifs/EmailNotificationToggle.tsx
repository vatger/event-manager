"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { useUserSettings } from "@/lib/stores/userSettingsStore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "../ui/button";

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
      const res = await fetch("/api/notifications/email", {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="rounded-full p-2 hover:bg-muted transition-colors bg-transparent"
          aria-label="Einstellungen"
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Benachrichtigungen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex justify-between items-center">
          <span className="text-sm">E-Mail</span>
          <Switch
            checked={emailNotificationsEnabled ?? false}
            onCheckedChange={handleToggle}
            disabled={emailNotificationsEnabled === null || loading}
          />
        </DropdownMenuItem>
        <DropdownMenuItem className="flex justify-between items-center">
          <span className="text-sm">
            Forum
          </span>
          <Switch checked disabled/>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
