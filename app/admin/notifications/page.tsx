// app/admin/notifications/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Users, Calendar, Filter, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Event, Signup } from "@/types";


export default function AdminNotificationCenter() {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [signups, setSignups] = useState<Signup[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    
    // Filter und Auswahl
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    
    // Nachricht
    const [notificationTitle, setNotificationTitle] = useState("");
    const [notificationMessage, setNotificationMessage] = useState("");
  
    // Lade alle Events
    useEffect(() => {
      const loadEvents = async () => {
        try {
          const response = await fetch('/api/events');
          if (response.ok) {
            const data = await response.json();
            setEvents(data);
          }
        } catch (error) {
          console.error('Error loading events:', error);
          toast.error('Fehler beim Laden der Events');
        }
      };
  
      loadEvents();
    }, []);
  
    // Lade Signups wenn Event ausgewählt
    useEffect(() => {
      if (!selectedEvent) {
        setSignups([]);
        setSelectedUsers([]);
        setSelectAll(false);
        return;
      }
  
      const loadSignups = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/events/${selectedEvent.id}/signup`);
          if (response.ok) {
            const data = await response.json();
            setSignups(data);
            // Setze selectedUsers zurück wenn Event gewechselt wird
            setSelectedUsers([]);
            setSelectAll(false);
          } else {
            toast.error('Fehler beim Laden der Anmeldungen');
          }
        } catch (error) {
          console.error('Error loading signups:', error);
          toast.error('Fehler beim Laden der Anmeldungen');
        } finally {
          setLoading(false);
        }
      };
  
      loadSignups();
    }, [selectedEvent]);
  
    // Filtere User basierend auf Search Term
    const filteredSignups = signups.filter(signup =>
      signup.user!.name!.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signup.user!.cid?.toString().includes(searchTerm)
    );
  
    // Select All Handler - ohne useEffect
    const handleSelectAll = useCallback((checked: boolean) => {
      setSelectAll(checked);
      if (checked) {
        setSelectedUsers(filteredSignups.map(s => s.userCID!.toString()));
      } else {
        setSelectedUsers([]);
      }
    }, [filteredSignups]);
  
    // Einzelnen User auswählen/abwählen
    const toggleUser = useCallback((userCID: string) => {
      setSelectedUsers(prev => {
        const newSelected = prev.includes(userCID)
          ? prev.filter(cid => cid !== userCID)
          : [...prev, userCID];
        
        // Update selectAll status based on current selection
        setSelectAll(newSelected.length === filteredSignups.length && filteredSignups.length > 0);
        
        return newSelected;
      });
    }, [filteredSignups.length]);
  
    // Update selectAll when filteredSignups changes
    useEffect(() => {
      if (filteredSignups.length > 0 && selectedUsers.length === filteredSignups.length) {
        setSelectAll(true);
      } else {
        setSelectAll(false);
      }
    }, [filteredSignups.length, selectedUsers.length]);
  
    // Benachrichtigungen senden
    const sendNotifications = async () => {
      if (!selectedEvent || selectedUsers.length === 0 || !notificationMessage.trim()) {
        toast.error('Bitte wähle ein Event, mindestens einen User und gib eine Nachricht ein');
        return;
      }
  
      setSending(true);
  
      try {
        const results = await Promise.allSettled(
          selectedUsers.map(userCID =>
            fetch(`/api/events/${selectedEvent.id}/notify-user`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userCID,
                customMessage: notificationMessage.trim(),
                customTitle: notificationTitle.trim() || `Update - ${selectedEvent.name}`
              }),
            })
          )
        );
  
        const successful = results.filter((r): r is PromiseFulfilledResult<Response> => 
          r.status === 'fulfilled' && r.value.ok
        ).length;
  
        const failed = results.length - successful;
  
        if (failed === 0) {
          toast.success(`${successful} Benachrichtigungen erfolgreich gesendet`);
          setNotificationMessage("");
          setNotificationTitle("");
          setSelectedUsers([]);
          setSelectAll(false);
        } else if (successful > 0) {
          toast.warning(`⚠️ ${successful} erfolgreich, ${failed} fehlgeschlagen`);
        } else {
          toast.error('❌ Alle Benachrichtigungen fehlgeschlagen');
        }
      } catch (error) {
        console.error('Error sending notifications:', error);
        toast.error('Netzwerkfehler beim Senden der Benachrichtigungen');
      } finally {
        setSending(false);
      }
    };
  
    // Automatischen Titel vorschlagen
    const getDefaultTitle = () => {
      if (!selectedEvent) return "";
      return `Update - ${selectedEvent.name}`;
    };
  
    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              Sende Benachrichtigungen an Event-Teilnehmer
            </p>
          </div>
        </div>
  
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Linke Spalte - Event Auswahl und User Liste */}
          <div className="lg:col-span-1 space-y-4">
            {/* Event Auswahl */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Event auswählen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {events.map(event => (
                      <div
                        key={event.id}
                        className={`p-3 border rounded-md cursor-pointer transition-colors ${
                          selectedEvent?.id === event.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="font-medium">{event.name}</div>
                        <div className="text-sm text-muted-foreground flex justify-between">
                          <span>
                            {new Date(event.startTime).toLocaleDateString('de-DE')}
                          </span>
                          <Badge variant="outline">
                            {event.registrations} Anm.
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Status: <Badge variant="secondary">{event.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
  
            {/* User Auswahl */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Teilnehmer auswählen
                  {selectedEvent && (
                    <Badge variant="secondary" className="ml-auto">
                      {selectedUsers.length}/{signups.length} ausgewählt
                    </Badge>
                  )}
                </CardTitle>
                {selectedEvent && (
                  <CardDescription>
                    {signups.length} angemeldete Teilnehmer
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {!selectedEvent ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Bitte wähle zuerst ein Event aus</p>
                  </div>
                ) : loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Lade Teilnehmer...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Suchfeld und Select All */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Teilnehmer suchen..."
                          className="pl-8"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      {filteredSignups.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="select-all"
                            checked={selectAll}
                            onCheckedChange={handleSelectAll}
                          />
                          <label
                            htmlFor="select-all"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Alle auswählen ({filteredSignups.length})
                          </label>
                        </div>
                      )}
                    </div>
  
                    {/* User Liste */}
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {filteredSignups.length === 0 ? (
                          <div className="text-center text-muted-foreground py-4">
                            {searchTerm ? 'Keine Teilnehmer gefunden' : 'Keine Anmeldungen'}
                          </div>
                        ) : (
                          filteredSignups.map(signup => (
                            <div
                              key={signup.id}
                              className="flex items-center space-x-3 p-2 border rounded-md hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={selectedUsers.includes(signup.userCID!.toString())}
                                onCheckedChange={() => toggleUser(signup.userCID!.toString())}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {signup.user!.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  CID: {signup.userCID!.toString()}
                                  {signup.endorsement && (
                                    <Badge variant="outline" className="ml-2">
                                      {signup.endorsement}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
  
          {/* Rechte Spalte - Nachricht erstellen und senden */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Benachrichtigung erstellen</CardTitle>
                <CardDescription>
                  {selectedEvent ? (
                    `Nachricht an ${selectedUsers.length} ausgewählte Teilnehmer von "${selectedEvent.name}"`
                  ) : (
                    "Wähle ein Event und Teilnehmer aus"
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Titel */}
                <div className="space-y-2">
                  <Label htmlFor="title">Titel (optional)</Label>
                  <Input
                    id="title"
                    placeholder={getDefaultTitle()}
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                  />
                </div>
  
                {/* Nachricht */}
                <div className="space-y-2">
                  <Label htmlFor="message">Nachricht *</Label>
                  <Textarea
                    id="message"
                    placeholder="Gib hier deine Benachrichtigungsnachricht ein..."
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>{notificationMessage.length} Zeichen</span>
                  </div>
                </div>
  
                {/* Vorschau */}
                {notificationMessage && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription>
                      <div className="font-medium text-blue-800 mb-1">Vorschau:</div>
                      <div className="text-sm text-blue-700">
                        <div className="font-semibold">
                          {notificationTitle || getDefaultTitle()}
                        </div>
                        <div className="mt-1">
                          {selectedEvent && `[${selectedEvent.name}] `}
                          {notificationMessage}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
  
                {/* Senden Button */}
                <Button
                  onClick={sendNotifications}
                  disabled={
                    !selectedEvent ||
                    selectedUsers.length === 0 ||
                    !notificationMessage.trim() ||
                    sending
                  }
                  className="w-full"
                  size="lg"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Sende {selectedUsers.length} Benachrichtigungen...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {selectedUsers.length > 0 
                        ? `An ${selectedUsers.length} Teilnehmer senden`
                        : 'Benachrichtigungen senden'
                      }
                    </>
                  )}
                </Button>
  
                {/* Hinweise */}
                <Alert variant="default" className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm">
                    <strong>Hinweis:</strong> Benachrichtigungen werden sowohl im Eventsystem 
                    als auch über das Forum an die ausgewählten User gesendet.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }