// app/admin/events/[id]/signups/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Download, Mail } from "lucide-react";
import { Signup } from "@/types";
import { useParams } from "next/navigation";

export default function EventSignupsPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [signups, setSignups] = useState<Signup[]>([]);
  const [filteredSignups, setFilteredSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadSignups();
  }, [eventId]);

  useEffect(() => {
    filterSignups();
  }, [searchTerm, signups]);

  const loadSignups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/signup`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setSignups(data);
    } catch (error) {
      console.error("Fehler:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterSignups = () => {
    if (!searchTerm) {
      setFilteredSignups(signups);
      return;
    }

    const filtered = signups.filter(signup =>
      signup.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signup.user?.cid?.toString().includes(searchTerm)
    );
    setFilteredSignups(filtered);
  };

  const exportToCSV = () => {
    const headers = ["CID", "Name", "Endorsement", "Position", "Verfügbarkeit", "Bemerkungen"];
    const csvData = signups.map(signup => [
      signup.user?.cid || "",
      signup.user?.name || "",
      signup.preferredStations || "",
      signup.availability ? "Ja" : "Nein",
      signup.remarks || ""
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anmeldungen-event-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Lade Anmeldungen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Anmeldungen</h1>
          <p className="text-muted-foreground">
            {signups.length} Controller haben sich angemeldet
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={loadSignups}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
          <Button asChild>
            <a href={`/admin/events/${eventId}/notify`}>
              <Mail className="h-4 w-4 mr-2" />
              Benachrichtigen
            </a>
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, CID oder Endorsement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Signups List */}
      <Card>
        <CardHeader>
          <CardTitle>Angemeldete Controller</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredSignups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Keine passenden Anmeldungen gefunden" : "Noch keine Anmeldungen"}
              </div>
            ) : (
              filteredSignups.map((signup) => (
                <div
                  key={signup.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium">
                        {signup.user?.name?.charAt(0) || "U"}
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium">
                        {signup.user?.name || "Unbekannt"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        CID: {signup.user?.cid || signup.userCID}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    
                    {signup.preferredStations && (
                      <div className="text-sm text-muted-foreground">
                        {signup.preferredStations}
                      </div>
                    )}

                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {signup.availability ? "Verfügbarkeit" : "Keine Angabe"}
                      </div>
                      {signup.remarks && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {signup.remarks}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}