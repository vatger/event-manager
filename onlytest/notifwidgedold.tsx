"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  eventId?: number | null;
  event: { name: string };
}

export default function NotificationsWidget() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notification[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setItems(data);
      console.log("Notifdata:", data)
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const unread = items.filter((n) => !n.readAt).length;

  const markRead = async (id: number) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (res.ok) {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-0 mr-4">
        <div className="p-3 border-b font-medium">Benachrichtigungen</div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Laden...</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Keine Benachrichtigungen</div>
          ) : (
            items.map((n) => (
              <div key={n.id} className={`p-3 text-sm border-b last:border-b-0 ${n.readAt ? "bg-background" : "bg-accent/40"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium leading-5">{n.title}</div>
                    <div className="text-muted-foreground leading-5">{n.message}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()} - {n.event.name}</div>
                  </div>
                  {!n.readAt && (
                    <Button size="icon" variant="ghost" onClick={() => markRead(n.id)} disabled={busy === n.id}>
                      {busy === n.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={load}>Aktualisieren</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
