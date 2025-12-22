// app/admin/events/[id]/notify/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Send, Users, UserSearch, AlertCircle, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Event, Signup } from "@/types";

interface UserSearchResult {
  cid: number;
  name: string | null;
  rating: string | null;
}

export default function EventNotificationPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"signups" | "all-users">("signups");
  
  // Signups state
  const [signups, setSignups] = useState<Signup[]>([]);
  const [signupsLoading, setSignupsLoading] = useState(false);
  
  // All users search state
  const [allUsersSearch, setAllUsersSearch] = useState("");
  const [allUsersResults, setAllUsersResults] = useState<UserSearchResult[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  
  const [sending, setSending] = useState(false);
  
  // Filter und Auswahl
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Nachricht
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");

  // Event-Daten laden
  useEffect(() => {
    const loadEvent = async () => {
      setEventLoading(true);
      try {
        const response = await fetch(`/api/events/${eventId}`);
        if (response.ok) {
          const data = await response.json();
          setEvent(data);
          // Setze Standard-Titel basierend auf Event
          setNotificationTitle(`Update - ${data.name}`);
        } else {
          toast.error('Fehler beim Laden des Events');
        }
      } catch (error) {
        console.error('Error loading event:', error);
        toast.error('Fehler beim Laden des Events');
      } finally {
        setEventLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  // Search all users
  const searchAllUsers = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setAllUsersResults([]);
      return;
    }

    setAllUsersLoading(true);
    try {
      const response = await fetch(`/api/user/search?q=${encodeURIComponent(query.trim())}`);
      if (response.ok) {
        const data = await response.json();
        setAllUsersResults(data);
      } else {
        toast.error('Fehler beim Suchen der Nutzer');
      }
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Fehler beim Suchen der Nutzer');
    } finally {
      setAllUsersLoading(false);
    }
  }, []);

  // Debounce user search
  useEffect(() => {
    if (activeTab !== "all-users") return;
    
    const timer = setTimeout(() => {
      searchAllUsers(allUsersSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [allUsersSearch, activeTab, searchAllUsers]);

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedUsers([]);
    setSelectAll(false);
    setSearchTerm("");
  }, [activeTab]);

  // Signups laden
  const loadSignups = useCallback(async () => {
    setSignupsLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/signup`);
      if (response.ok) {
        const data = await response.json();
        setSignups(data);
        if (activeTab === "signups") {
          setSelectedUsers([]);
          setSelectAll(false);
        }
      } else {
        toast.error('Fehler beim Laden der Anmeldungen');
      }
    } catch (error) {
      console.error('Error loading signups:', error);
      toast.error('Fehler beim Laden der Anmeldungen');
    } finally {
      setSignupsLoading(false);
    }
  }, [eventId, activeTab]);

  // Initial Signups laden
  useEffect(() => {
    if (eventId) {
      loadSignups();
    }
  }, [eventId, loadSignups]);

  // Filtere User basierend auf Search Term  
  const filteredSignups = signups.filter(signup =>
    signup.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    signup.user?.cid?.toString().includes(searchTerm) ||
    signup.userCID?.toString().includes(searchTerm)
  );

  // Filter all users results based on search term
  const filteredAllUsers = allUsersResults.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.cid.toString().includes(searchTerm)
  );

  // Get current list based on active tab
  const getCurrentList = () => {
    if (activeTab === "signups") {
      return filteredSignups.map(s => ({
        cid: s.userCID || s.user?.cid || 0,
        name: s.user?.name || "Unbekannt",
        rating: null
      }));
    } else {
      return filteredAllUsers;
    }
  };

  const currentList = getCurrentList();

  // Select All Handler
  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedUsers(currentList.map(u => u.cid.toString()));
    } else {
      setSelectedUsers([]);
    }
  }, [currentList]);

  // Einzelnen User auswählen/abwählen
  const toggleUser = useCallback((userCID: string) => {
    setSelectedUsers(prev => {
      const newSelected = prev.includes(userCID)
        ? prev.filter(cid => cid !== userCID)
        : [...prev, userCID];
      
      // Update selectAll status based on current selection
      setSelectAll(newSelected.length === currentList.length && currentList.length > 0);
      
      return newSelected;
    });
  }, [currentList.length]);

  // Update selectAll when current list changes
  useEffect(() => {
    if (currentList.length > 0 && selectedUsers.length === currentList.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [currentList.length, selectedUsers.length]);

  // Benachrichtigungen senden
  const sendNotifications = async () => {
    if (!event || selectedUsers.length === 0 || !notificationMessage.trim()) {
      toast.error('Bitte wähle mindestens einen User und gib eine Nachricht ein');
      return;
    }

    setSending(true);

    try {
      if (activeTab === "signups") {
        // Send to signed up users
        const results = await Promise.allSettled(
          selectedUsers.map(userCID =>
            fetch(`/api/events/${event.id}/notify-user`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userCID,
                customMessage: notificationMessage.trim(),
                customTitle: notificationTitle.trim() || `Update - ${event.name}`,
                eventId: event.id
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
          setSelectedUsers([]);
          setSelectAll(false);
        } else if (successful > 0) {
          toast.warning(`${successful} erfolgreich, ${failed} fehlgeschlagen`);
        } else {
          toast.error('Alle Benachrichtigungen fehlgeschlagen');
        }
      } else {
        // Send to all users via notify-candidates endpoint
        const response = await fetch(`/api/events/${event.id}/notify-candidates`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userCIDs: selectedUsers.map(Number),
            customMessage: notificationMessage.trim(),
            customTitle: notificationTitle.trim() || `Benachrichtigung - ${event.name}`,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          toast.success(`${result.stats.successful} Benachrichtigungen erfolgreich gesendet`);
          setNotificationMessage("");
          setSelectedUsers([]);
          setSelectAll(false);
        } else {
          const error = await response.json();
          toast.error(error.message || 'Fehler beim Senden der Benachrichtigungen');
        }
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
      toast.error('Netzwerkfehler beim Senden der Benachrichtigungen');
    } finally {
      setSending(false);
    }
  };

  const handleReload = () => {
    if (activeTab === "signups") {
      loadSignups();
    } else {
      // For all users, just reset the search
      setAllUsersSearch("");
      setAllUsersResults([]);
    }
  };

  if (eventLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Lade Event...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-8 text-red-500">
        <AlertCircle className="h-12 w-12 mx-auto mb-4" />
        <p>Event nicht gefunden</p>
      </div>
    );
  }

  const isLoading = activeTab === "signups" ? signupsLoading : allUsersLoading;
  const totalCount = activeTab === "signups" ? signups.length : allUsersResults.length;

  return (
    <div className="space-y-6">
      {/* Header mit Event Info */}
      <Card>
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <h1 className="text-2xl font-bold">Benachrichtigungen</h1>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleReload} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4" /> <p className="hidden sm:block ml-1">Neu laden</p>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linke Spalte - User Liste mit Tabs */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signups" | "all-users")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signups" className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Teilnehmer</span>
                  </TabsTrigger>
                  <TabsTrigger value="all-users" className="flex items-center gap-1">
                    <UserSearch className="h-4 w-4" />
                    <span className="hidden sm:inline">Alle Nutzer</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center justify-between mt-2">
                <CardDescription>
                  {activeTab === "signups" 
                    ? `${signups.length} angemeldete Teilnehmer`
                    : "Suche nach Nutzern"
                  }
                </CardDescription>
                <Badge variant="secondary">
                  {selectedUsers.length}/{totalCount} ausgewählt
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">
                    {activeTab === "signups" ? "Lade Teilnehmer..." : "Suche Nutzer..."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Suchfeld und Select All */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={activeTab === "signups" ? "Teilnehmer suchen..." : "Nutzer suchen (mind. 2 Zeichen)..."}
                        className="pl-8"
                        value={activeTab === "signups" ? searchTerm : allUsersSearch}
                        onChange={(e) => activeTab === "signups" ? setSearchTerm(e.target.value) : setAllUsersSearch(e.target.value)}
                      />
                    </div>
                    {currentList.length > 0 && (
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
                          Alle auswählen ({currentList.length})
                        </label>
                      </div>
                    )}
                  </div>

                  {/* User Liste */}
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {currentList.length === 0 ? (
                        <div className="text-center text-muted-foreground py-4">
                          {activeTab === "signups" 
                            ? (searchTerm ? 'Keine Teilnehmer gefunden' : 'Keine Anmeldungen')
                            : (allUsersSearch.length < 2 
                                ? 'Gib mindestens 2 Zeichen ein'
                                : 'Keine Nutzer gefunden'
                              )
                          }
                        </div>
                      ) : (
                        currentList.map(user => {
                          const userCID = user.cid.toString();
                          return (
                            <div
                              key={`${activeTab}-${userCID}`}
                              className="flex items-center space-x-3 p-2 border rounded-md hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={selectedUsers.includes(userCID)}
                                onCheckedChange={() => toggleUser(userCID)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {user.name || "Unbekannt"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  CID: {userCID}{user.rating ? ` • ${user.rating}` : ''}
                                </div>
                              </div>
                            </div>
                          );
                        })
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
                {selectedUsers.length > 0 
                  ? `Nachricht an ${selectedUsers.length} ${activeTab === "signups" ? "ausgewählte Teilnehmer" : "ausgewählte Nutzer"}`
                  : activeTab === "signups"
                    ? "Wähle Teilnehmer aus, um eine Benachrichtigung zu senden"
                    : "Wähle Nutzer aus, um eine Benachrichtigung zu senden"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Titel */}
              <div className="space-y-2">
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  placeholder={`Update - ${event.name}`}
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
                  rows={8}
                  className="resize-none"
                />
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>{notificationMessage.length} Zeichen</span>
                </div>
              </div>

              {/* Vorschau */}
              {notificationMessage && (
                <Alert
                  className="
                    border-blue-200 bg-blue-50 text-blue-900
                    dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200
                  "
                >
                 <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">Vorschau:</div>
                    <div className="text-sm">
                      <div className="font-semibold">
                        {notificationTitle || `Update - ${event.name}`}
                      </div>
                      <div className="mt-1">
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
                      ? `An ${selectedUsers.length} ${activeTab === "signups" ? "Teilnehmer" : "Nutzer"} senden`
                      : 'Benachrichtigungen senden'
                    }
                  </>
                )}
              </Button>

              {/* Hinweise */}
              <Alert
                variant="default"
                className="
                  border-amber-200 bg-amber-50 text-amber-900
                  dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300
                "
              >
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