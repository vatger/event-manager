import { Signup } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEndorsements } from "./useEndorsements";

interface StatsCardProps {
  signups: Signup[];
  event?: { airports?: string | string[]; fir?: string };
}

export default function StatsCard({ signups, event }: StatsCardProps) {
  const { data: endorsementData, loading } = useEndorsements(signups, event);
  const stats = {
    GND: 0,
    TWR: 0,
    APP: 0,
    CTR: 0,
    UNSPEC: 0
  };

  // Statistik berechnen
  signups.forEach((s) => {
    const cid = String(s.user?.cid ?? s.userCID ?? "");
    const k = (endorsementData[cid]?.group || "UNSPEC") as string;
    if (stats[k as keyof typeof stats] !== undefined) {
      stats[k as keyof typeof stats] += 1;
    } else {
      stats.UNSPEC += 1;
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Controller Statistik{loading && <span className="ml-2 text-sm text-muted-foreground">lädt…</span>}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
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
          <div>
            <p className="text-sm text-muted-foreground">Unbekannt</p>
            <p className="text-xl font-semibold">{stats.UNSPEC}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
