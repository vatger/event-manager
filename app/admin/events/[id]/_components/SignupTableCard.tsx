import { Event, Signup } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SignupsTable, { SignupsTableRef } from "@/components/SignupsTable";
import { RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { useUser } from "@/hooks/useUser";

interface SignupsTableCardProps {
  event: Event;
  onRefresh: () => void;
}

export default function SignupsTableCard({ 
  event, 
  onRefresh 
}: SignupsTableCardProps) {

  const tableRef = useRef<SignupsTableRef>(null);
  const { canInFIR } = useUser();
  const handleSignupChanged = () => {
    tableRef.current?.reload();
  };
  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
      <CardTitle className="flex justify-between">
        <div className="flex items-center gap-2">
        <Users className="w-5 h-5" />
          Angemeldete Teilnehmer
        </div>
        <Button onClick={handleSignupChanged} variant="outline" size="sm">
          <RotateCcw className="h-4 w-4" /> <p className="hidden sm:block ml-1">Neu laden</p>
        </Button>
      </CardTitle>
      </CardHeader>
      <CardContent>
        <SignupsTable
          ref={tableRef}
          eventId={Number(event.id)}
          editable={canInFIR(event.firCode, "signups.manage")}
          event={event}
          onRefresh={onRefresh}
        />
      </CardContent>
    </Card>
  );
}