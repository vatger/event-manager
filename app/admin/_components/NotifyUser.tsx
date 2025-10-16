"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Send, User, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Signup } from "@/types";

interface UserNotificationProps {
  eventId: string;
  eventName: string;
  signups: Signup[];
}

export function UserNotificationSender({ eventId, eventName, signups }: UserNotificationProps) {
  const [selectedUserCID, setSelectedUserCID] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [lastSent, setLastSent] = useState<{ cid: string; name: string } | null>(null);

  const handleSendNotification = async () => {
    if (!selectedUserCID || !customMessage.trim()) {
      toast.error("Bitte wähle einen User und gib eine Nachricht ein");
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch(`/api/events/${eventId}/notify-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userCID: selectedUserCID,
          customMessage: customMessage.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Benachrichtigung an ${data.user.name} (${data.user.cid}) gesendet`);
        setLastSent(data.user);
        setCustomMessage("");
        setSelectedUserCID("");
      } else {
        toast.error(data.error || "Fehler beim Senden der Benachrichtigung");
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      toast.error("Netzwerkfehler beim Senden der Benachrichtigung");
    } finally {
      setIsSending(false);
    }
  };

  const getSelectedUserName = () => {
    const user = signups.find(s => s.userCID === selectedUserCID);
    return user ? user.user!.name : "Unbekannt";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Benachrichtigungen senden
        </CardTitle>
        <CardDescription>
          Sende eine benutzerdefinierte Roster-Benachrichtigung an einen einzelnen Teilnehmer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Letzte Bestätigung anzeigen */}
        {lastSent && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription>
              ✅ Benachrichtigung erfolgreich gesendet an{" "}
              <strong>{lastSent.name}</strong> (CID: {lastSent.cid})
            </AlertDescription>
          </Alert>
        )}

        {/* User Auswahl */}
        <div className="space-y-2">
          <Label htmlFor="user-select">Teilnehmer auswählen</Label>
          <select
            id="user-select"
            value={selectedUserCID}
            onChange={(e) => setSelectedUserCID(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">Wähle einen Teilnehmer...</option>
            {signups.map((signup) => (
              <option key={signup.id} value={signup.userCID}>
                {signup.user!.name} (CID: {signup.userCID})
              </option>
            ))}
          </select>
          {selectedUserCID && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              Ausgewählt: {getSelectedUserName()}
            </div>
          )}
        </div>

        {/* Nachricht Eingabe */}
        <div className="space-y-2">
          <Label htmlFor="custom-message">Benutzerdefinierte Nachricht</Label>
          <Textarea
            id="custom-message"
            placeholder={`Gib hier deine benutzerdefinierte Nachricht ein...\n\nBeispiel:\n"Deine Position wurde aktualisiert. Bitte überprüfe das Roster für die neuesten Änderungen."`}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <div className="text-xs text-muted-foreground">
            {customMessage.length} Zeichen
          </div>
        </div>

        {/* Vorschau */}
        {selectedUserCID && customMessage && (
          <div className="p-3 border rounded-md bg-muted/50">
            <h4 className="text-sm font-medium mb-2">Vorschau der Benachrichtigung:</h4>
            <div className="text-sm space-y-1">
              <div>
                <Badge variant="secondary" className="mb-1">
                  Titel
                </Badge>
                <div>Roster Update - {eventName}</div>
              </div>
              <div>
                <Badge variant="secondary" className="mb-1">
                  Nachricht
                </Badge>
                <div>Roster Update für {eventName}: {customMessage}</div>
              </div>
            </div>
          </div>
        )}

        {/* Senden Button */}
        <Button
          onClick={handleSendNotification}
          disabled={!selectedUserCID || !customMessage.trim() || isSending}
          className="w-full"
        >
          {isSending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Wird gesendet...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Benachrichtigung senden
            </>
          )}
        </Button>

        {/* Hinweis */}
        <Alert variant="default" className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Die Benachrichtigung wird sowohl im Eventsystem als auch über die VATGER-API an den User gesendet.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}