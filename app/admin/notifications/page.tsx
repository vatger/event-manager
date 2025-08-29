"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import Protected from "@/components/Protected";

interface EventLite { id: number; name: string }

export default function AdminNotificationsPage() {
  const [events, setEvents] = useState<EventLite[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");

  useEffect(() => {
    fetch("/api/events").then((r) => r.json()).then((data) => {
      setEvents(data.map((e: any) => ({ id: e.id, name: e.name })));
    });
  }, []);

  const send = async () => {
    if (!eventId || !title || !message) return;
    setBusy(true);
    try {
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: Number(eventId), title, message, type: "EVENT" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setResult(`Gesendet: ${data.created} Nachrichten`);
      setTitle("");
      setMessage("");
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Protected>
      <div className="container mx-auto py-10 space-y-6">
        <h1 className="text-2xl font-bold">Benachrichtigungen</h1>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Event</label>
                <select className="w-full border rounded-md px-3 py-2" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                  <option value="">— wählen —</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Titel</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel der Nachricht"/>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Nachricht</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Text für die angemeldeten Nutzer" rows={5}/>
            </div>
            <div className="flex justify-end">
              <Button onClick={send} disabled={busy || !eventId || !title || !message}>{busy ? "Senden…" : "Senden"}</Button>
            </div>
            {result && <div className="text-sm text-muted-foreground">{result}</div>}
          </CardContent>
        </Card>
      </div>
    </Protected>
  );
}
