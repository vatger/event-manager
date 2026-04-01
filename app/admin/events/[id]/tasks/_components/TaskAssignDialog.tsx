"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface TeamMember {
  cid: number;
  name: string;
  rating: string;
  role: string;
}

interface TaskAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: TeamMember[];
  onAssign: (cid: number) => void;
}

export function TaskAssignDialog({
  open,
  onOpenChange,
  teamMembers,
  onAssign,
}: TaskAssignDialogProps) {
  const [selectedCid, setSelectedCid] = useState<string>("");

  const handleAssign = () => {
    if (!selectedCid) return;
    onAssign(Number(selectedCid));
    setSelectedCid("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setSelectedCid(""); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aufgabe zuweisen</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Select value={selectedCid} onValueChange={setSelectedCid}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Teammitglied auswählen" />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.map((m) => (
                <SelectItem key={m.cid} value={String(m.cid)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleAssign} disabled={!selectedCid}>
            Zuweisen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
