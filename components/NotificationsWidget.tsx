"use client";

import { useEffect, useState } from "react";
import { 
  Bell, 
  Check, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Calendar,
  Info,
  AlertTriangle,
  TowerControl,
  RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Event } from "@/types";
import Link from "next/link";

interface Notification {
  id: number;
  type: 'EVENT' | 'SYSTEM' | 'INFO' | "OTHER";
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  eventId?: number | null;
  event: Event;
}

export default function NotificationsWidget() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notification[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setItems(data);
    } catch (e) {
      console.error("Fehler beim Laden der Benachrichtigungen:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    
    // Polling für neue Benachrichtigungen alle 2 Minuten
    const interval = setInterval(load, 120000);
    return () => clearInterval(interval);
  }, []);

  const unread = items.filter((n) => !n.readAt).length;

  const markRead = async (id: number) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH"
      });
      if (res.ok) {
        setItems((prev) => 
          prev.map((n) => 
            n.id === id ? { ...n, readAt: new Date().toISOString() } : n
          )
        );
      }
    } catch (error) {
      console.error("Fehler beim Markieren als gelesen:", error);
    } finally {
      setBusy(null);
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "PATCH"
      });
      
      if (res.ok) {
        const result = await res.json();
        setItems((prev) => 
          prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
        );
        toast.success(`${result.count} ${result.count==1 ? "Benachrichtigung" : "Benachrichtigungen"} als gelesen markiert`);
      } else {
        throw new Error("Server responded with error");
      }
    } catch (error) {
      console.error("Fehler beim Markieren aller als gelesen:", error);
      toast.error("Benachrichtigungen konnten nicht als gelesen markieren werden");
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'OTHER':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'SYSTEM':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'INFO':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'EVENT':
        return <TowerControl className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Vor weniger als einer Stunde';
    } else if (diffInHours < 24) {
      return `Vor ${diffInHours} Stunden`;
    } else {
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getEventStatusBadge = (status: Event['status']) => {
    const statusConfig = {
      PLANNING: { label: 'Geplant', variant: 'outline' as const },
      SIGNUP_OPEN: { label: 'Anmeldung', variant: 'default' as const },
      ROSTER_PUBLISHED: { label: 'Besetzungsplan', variant: 'secondary' as const },
      DRAFT: { label: 'Entwurf', variant: 'secondary' as const },
      SIGNUP_CLOSED: { label: 'geschlossen', variant: 'secondary' as const },
      CANCELLED: { label: 'abgesagt', variant: 'secondary' as const },
    };
    
    const config = statusConfig[status];
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative rounded-full"
          aria-label="Benachrichtigungen anzeigen"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-96 max-h-[80vh] overflow-hidden mr-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Benachrichtigungen</h3>
          {unread > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllRead}
              disabled={busy !== null}
            >
              {busy !== null ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              Alle lesen
            </Button>
          )}
        </div>
        
        <div className="max-h-[calc(80vh-8rem)] overflow-y-auto">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 border-b">
                <div className="flex items-start space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Keine Benachrichtigungen</p>
              <p className="text-xs text-muted-foreground mt-1">
                Du wirst benachrichtigt, wenn neue Events oder Updates verfügbar sind.
              </p>
            </div>
          ) : (
            items.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "p-4 border-b transition-colors hover:bg-muted/30",
                  notification.readAt ? "bg-background" : "bg-accent/40"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-sm leading-none">
                          {notification.title}
                        </h4>
                        <p className="text-muted-foreground text-sm mt-1">
                          {notification.message}
                        </p>
                      </div>
                      
                      {!notification.readAt && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => markRead(notification.id)}
                          disabled={busy === notification.id}
                          aria-label="Als gelesen markieren"
                        >
                          {busy === notification.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                    
                    {notification.event && (
                      <Link href={window.location.origin + "/events/" + notification.eventId} onClick={() => markRead(notification.id)}>
                        <div className="bg-muted p-2 rounded-md text-xs space-y-1">
                          <div className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3" />
                            {notification.event.name}
                          </div>
                          <div className="flex items-center justify-between">
                            <span>
                              {new Date(notification.event.startTime).toLocaleDateString('de-DE')}
                            </span>
                            {getEventStatusBadge(notification.event.status)}
                          </div>
                        </div>
                      </Link>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(notification.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        <div className="p-1">
          <DropdownMenuItem onClick={(e) => {
            e.preventDefault();
            load();
            }} className="cursor-pointer">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Aktualisieren
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}