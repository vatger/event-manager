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
import { Search, Send, Users, UserPlus, AlertCircle, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Event, Signup } from "@/types";

interface Candidate {
  cid: number;
  name: string | null;
  rating: string | null;
  signedUp: boolean;
}

interface CandidatesApiResponse {
  event: {
    id: number;
    name: string;
    airports: string[];
    firCode: string | null;
  };
  candidates: Candidate[];
  isTier1: boolean;
}

export default function EventNotificationPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"signups" | "candidates">("signups");
  
  // Signups state
  const [signups, setSignups] = useState<Signup[]>([]);
  const [signupsLoading, setSignupsLoading] = useState(false);
  
  // Candidates state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [isTier1, setIsTier1] = useState(false);
  
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

  // Signups laden
  const loadSignups = useCallback(async () => {
    setSignupsLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/signup`);
      if (response.ok) {
        const data = await response.json();
        setSignups(data);
        // Reset selection when reloading
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

  // Candidates laden
  const loadCandidates = useCallback(async () => {
    setCandidatesLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/candidates`);
      if (response.ok) {
        const data: CandidatesApiResponse = await response.json();
        setIsTier1(data.isTier1);
        if (data.isTier1 && data.candidates) {
          // Filter out candidates who are already signed up
          const notSignedUp = data.candidates.filter(c => !c.signedUp);
          setCandidates(notSignedUp);
        } else {
          setCandidates([]);
        }
        // Reset selection when reloading
        if (activeTab === "candidates") {
          setSelectedUsers([]);
          setSelectAll(false);
        }
      } else {
        toast.error('Fehler beim Laden der potentiellen Lotsen');
      }
    } catch (error) {
      console.error('Error loading candidates:', error);
      toast.error('Fehler beim Laden der potentiellen Lotsen');
    } finally {
      setCandidatesLoading(false);
    }
  }, [eventId, activeTab]);

  // Initial data laden
  useEffect(() => {
    if (eventId) {
      loadSignups();
      loadCandidates();
    }
  }, [eventId, loadSignups, loadCandidates]);

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedUsers([]);
    setSelectAll(false);
    setSearchTerm("");
  }, [activeTab]);

  // Get filtered list based on active tab
  const getFilteredList = useCallback(() => {
    if (activeTab === "signups") {
      return signups.filter(signup =>
        signup.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signup.user?.cid?.toString().includes(searchTerm) ||
        signup.userCID?.toString().includes(searchTerm)
      );
    } else {
      return candidates.filter(candidate =>
        candidate.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.cid.toString().includes(searchTerm)
      );
    }
  }, [activeTab, signups, candidates, searchTerm]);

  const filteredList = getFilteredList();

  // Get user CID from item
  const getUserCID = (item: Signup | Candidate): string => {
    if ('userCID' in item) {
      return item.userCID?.toString() || (item as Signup).user?.cid?.toString() || "";
    }
    return (item as Candidate).cid.toString();
  };

  // Get user name from item
  const getUserName = (item: Signup | Candidate): string => {
    if ('user' in item && item.user) {
      return item.user.name || "Unbekannt";
    }
    return (item as Candidate).name || "Unbekannt";
  };

  // Get rating from item (only for candidates)
  const getUserRating = (item: Signup | Candidate): string | null => {
    if ('rating' in item) {
      return (item as Candidate).rating;
    }
    return null;
  };

  // Select All Handler
  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedUsers(filteredList.map(item => getUserCID(item)));
    } else {
      setSelectedUsers([]);
    }
  }, [filteredList]);

  // Einzelnen User auswählen/abwählen
  const toggleUser = useCallback((userCID: string) => {
    setSelectedUsers(prev => {
      const newSelected = prev.includes(userCID)
        ? prev.filter(cid => cid !== userCID)
        : [...prev, userCID];
      
      // Update selectAll status based on current selection
      setSelectAll(newSelected.length === filteredList.length && filteredList.length > 0);
      
      return newSelected;
    });
  }, [filteredList.length]);

  // Update selectAll when filteredList changes
  useEffect(() => {
    if (filteredList.length > 0 && selectedUsers.length === filteredList.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [filteredList.length, selectedUsers.length]);

  // Benachrichtigungen senden
  const sendNotifications = async () => {
    if (!event || selectedUsers.length === 0 || !notificationMessage.trim()) {
      toast.error('Bitte wähle mindestens einen User und gib eine Nachricht ein');
      return;
    }

    setSending(true);

    try {
      if (activeTab === "signups") {
        // Send to signed up users (existing functionality)
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
        // Send to candidates (new functionality)
        const response = await fetch(`/api/events/${event.id}/notify-candidates`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userCIDs: selectedUsers.map(Number),
            customMessage: notificationMessage.trim(),
            customTitle: notificationTitle.trim() || `Unterstützung gesucht - ${event.name}`,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          toast.success(`${result.stats.successful} Benachrichtigungen an potentielle Lotsen gesendet`);
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
      loadCandidates();
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

  const isLoading = activeTab === "signups" ? signupsLoading : candidatesLoading;
  const totalCount = activeTab === "signups" ? signups.length : candidates.length;
  const defaultTitle = activeTab === "signups" 
    ? `Update - ${event.name}` 
    : `Unterstützung gesucht - ${event.name}`;
  const defaultMessage = activeTab === "candidates" 
    ? `Wir suchen noch Unterstützung für das Event "${event.name}". Hast du Lust, uns zu helfen? Melde dich jetzt an!`
    : "";

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
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signups" | "candidates")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signups" className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Teilnehmer</span>
                  </TabsTrigger>
                  <TabsTrigger value="candidates" className="flex items-center gap-1">
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Potentielle Lotsen</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center justify-between mt-2">
                <CardDescription>
                  {activeTab === "signups" 
                    ? `${signups.length} angemeldete Teilnehmer`
                    : isTier1 
                      ? `${candidates.length} potentielle Lotsen`
                      : "Nur für Tier-1 Airports verfügbar"
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
                    {activeTab === "signups" ? "Lade Teilnehmer..." : "Lade potentielle Lotsen..."}
                  </p>
                </div>
              ) : activeTab === "candidates" && !isTier1 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Potentielle Lotsen sind nur für Events mit Tier-1 Airports verfügbar.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Suchfeld und Select All */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={activeTab === "signups" ? "Teilnehmer suchen..." : "Lotsen suchen..."}
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    {filteredList.length > 0 && (
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
                          Alle auswählen ({filteredList.length})
                        </label>
                      </div>
                    )}
                  </div>

                  {/* User Liste */}
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {filteredList.length === 0 ? (
                        <div className="text-center text-muted-foreground py-4">
                          {searchTerm 
                            ? (activeTab === "signups" ? 'Keine Teilnehmer gefunden' : 'Keine Lotsen gefunden')
                            : (activeTab === "signups" ? 'Keine Anmeldungen' : 'Keine potentiellen Lotsen')
                          }
                        </div>
                      ) : (
                        filteredList.map((item) => {
                          const userCID = getUserCID(item);
                          const userName = getUserName(item);
                          const rating = getUserRating(item);
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
                                  {userName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  CID: {userCID}{rating ? ` • ${rating}` : ''}
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
                  ? activeTab === "signups"
                    ? `Nachricht an ${selectedUsers.length} ausgewählte Teilnehmer`
                    : `Nachricht an ${selectedUsers.length} potentielle Lotsen`
                  : activeTab === "signups"
                    ? "Wähle Teilnehmer aus, um eine Benachrichtigung zu senden"
                    : "Wähle potentielle Lotsen aus, um sie zur Anmeldung einzuladen"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Titel */}
              <div className="space-y-2">
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  placeholder={defaultTitle}
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                />
              </div>

              {/* Nachricht */}
              <div className="space-y-2">
                <Label htmlFor="message">Nachricht *</Label>
                <Textarea
                  id="message"
                  placeholder={activeTab === "candidates" 
                    ? "z.B.: Wir suchen noch Unterstützung für dieses Event. Melde dich jetzt an!"
                    : "Gib hier deine Benachrichtigungsnachricht ein..."
                  }
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  rows={8}
                  className="resize-none"
                />
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>{notificationMessage.length} Zeichen</span>
                  {activeTab === "candidates" && notificationMessage.length === 0 && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 text-xs"
                      onClick={() => setNotificationMessage(defaultMessage)}
                    >
                      Vorlage verwenden
                    </Button>
                  )}
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
                        {notificationTitle || defaultTitle}
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
                      ? activeTab === "signups"
                        ? `An ${selectedUsers.length} Teilnehmer senden`
                        : `An ${selectedUsers.length} potentielle Lotsen senden`
                      : 'Benachrichtigungen senden'
                    }
                  </>
                )}
              </Button>

              {/* Hinweise */}
              <Alert variant="default" className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  {activeTab === "signups" ? (
                    <>
                      <strong>Hinweis:</strong> Benachrichtigungen werden sowohl im Eventsystem 
                      als auch über das Forum an die ausgewählten User gesendet.
                    </>
                  ) : (
                    <>
                      <strong>Hinweis:</strong> Diese Nachricht wird an potentielle Lotsen gesendet, 
                      die noch nicht für das Event angemeldet sind. Sie werden aufgefordert, sich anzumelden.
                    </>
                  )}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}