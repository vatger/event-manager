import { Event, Signup } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SignupsTable from "@/components/SignupsTable";

interface SignupsTableCardProps {
  signups: Signup[];
  event: Event;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

export default function SignupsTableCard({ 
  signups, 
  event, 
  loading, 
  error, 
  onRefresh 
}: SignupsTableCardProps) {
  const tableEvent = event ? { 
    id: event.id, 
    startTime: event.startTime, 
    endTime: event.endTime,
    airport: Array.isArray(event.airports) ? event.airports[0] : event.airports,
    fir: "EDMM"
  } : undefined;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle>Alle Anmeldungen</CardTitle>
      </CardHeader>
      <CardContent>
        <SignupsTable
          eventId={Number(event.id)}
          editable={true}
          event={event}
          onRefresh={onRefresh}
        />
      </CardContent>
    </Card>
  );
}