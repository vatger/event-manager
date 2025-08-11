"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge"

interface Signup {
  id: string;
  user: { name: string; email: string; cid: string; endorsements?: string };
  position: string; // z.B. "GND", "TWR"
  from: string;
}

export default function ViewSignupsPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignups = async () => {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}/signups`);
      const data = await res.json();
      setSignups(data);
      setLoading(false);
    };

    fetchSignups();
  }, [eventId]);

  const stats = {
    GND: signups.filter(s => s.position === "GND").length,
    TWR: signups.filter(s => s.position === "TWR").length,
    APP: signups.filter(s => s.position === "APP").length,
    CTR: signups.filter(s => s.position === "CTR").length,
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Event Signups</h1>
        <div className="flex gap-2">
          <Button variant="outline">Upload Briefing</Button>
          <Button variant="default">Publish Roster</Button>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Controller Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">GND</p>
              <p className="text-xl font-semibold">{stats.GND}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">TWR</p>
              <p className="text-xl font-semibold">{stats.TWR}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">APP</p>
              <p className="text-xl font-semibold">{stats.APP}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CTR</p>
              <p className="text-xl font-semibold">{stats.CTR}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Tabelle */}
      <Card>
        <CardHeader>
          <CardTitle>All Signups</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signups.map((s) => (
                <TableRow key={s.id}>
                    <TableCell>{s.user.cid}</TableCell>
                  <TableCell>
                    {s.user.name}
                    <Badge className="ml-2" variant="secondary">
                      {s.user.endorsements || "N/A"}
                      </Badge>
                    </TableCell>
                  <TableCell>{s.from}</TableCell>
                  <TableCell>{s.position}</TableCell>
                </TableRow>
              ))}
              {signups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No signups yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
