// app/admin/events/[id]/notify/page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Send, Users, Mail } from "lucide-react";
import { useParams } from "next/navigation";

export default function EventNotifyPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [message, setMessage] = useState("");
  const [includeAllUsers, setIncludeAllUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);

  const handleSendNotification = async () => {
    if (!message.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`/api/events/${eventId}/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message.trim(),
          includeAllUsers,
          eventId
        }),
      });

      if (!response.ok) throw new Error("Fehler beim Senden");

      setLastSent(new Date());
      setMessage("");
      // Erfolgsmeldung anzeigen
    } catch (error) {
      console.error("Fehler:", error);
      // Fehlermeldung anzeigen
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Benachrichtigungen</h1>
        <p className="text-muted-foreground">
          Sende Nachrichten an angemeldete Controller
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nachricht erstellen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Nachricht</Label>
              <Textarea
                id="message"
                placeholder="Schreibe deine Nachricht an die Teilnehmer..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="resize-none"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="include-all"
                checked={includeAllUsers}
                onCheckedChange={setIncludeAllUsers}
              />
              <Label htmlFor="include-all">
                An alle qualifizierten Controller senden (nicht nur angemeldete)
              </Label>
            </div>

            <Button 
              onClick={handleSendNotification}
              disabled={!message.trim() || sending}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Wird gesendet..." : "Benachrichtigung senden"}
            </Button>
          </CardContent>
        </Card>

        {/* Info Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle>Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Empfänger</div>
                <div className="text-sm text-muted-foreground">
                  {includeAllUsers ? "Alle qualifizierten Controller" : "Nur angemeldete Controller"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Kanal</div>
                <div className="text-sm text-muted-foreground">
                  E-Mail & System-Benachrichtigung
                </div>
              </div>
            </div>

            {lastSent && (
              <div className="pt-4 border-t">
                <div className="text-sm font-medium mb-2">Letzte Benachrichtigung</div>
                <Badge variant="outline">
                  {lastSent.toLocaleString("de-DE")}
                </Badge>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                <strong>Tipp:</strong> Benachrichtigungen werden per E-Mail und im System an die Empfänger gesendet.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}