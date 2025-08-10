"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: any; // Bei dir später gerne mit Event-Typ
  onSuccess: () => void;
}

export function EventFormDialog({ open, onOpenChange, event, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: "",
    airport: "",
    startTime: "",
    endTime: "",
    signupDeadline: "",
    googleSheetId: "",
    createdBy: "Admin",
  });

  useEffect(() => {
    if (event) {
      setForm({
        name: event.name,
        airport: event.airport,
        startTime: event.startTime?.slice(0, 16) || "",
        endTime: event.endTime?.slice(0, 16) || "",
        signupDeadline: event.signupDeadline?.slice(0, 16) || "",
        googleSheetId: event.googleSheetId || "",
        createdBy: event.createdBy || "Admin",
      });
    } else {
      setForm({
        name: "",
        airport: "",
        startTime: "",
        endTime: "",
        signupDeadline: "",
        googleSheetId: "",
        createdBy: "Admin",
      });
    }
  }, [event]);

  const handleSubmit = async () => {
    const method = event ? "PATCH" : "POST";
    const url = event ? `/api/events/${event.id}` : "/api/events";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        signupDeadline: new Date(form.signupDeadline).toISOString(),
        status: event ? event.status : "upcoming",
      }),
    });

    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "Create New Event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {["name", "airport", "startTime", "endTime", "signupDeadline", "googleSheetId"].map((field) => (
            <div key={field}>
              <Label className="pb-2 capitalize">{field}</Label>
              <Input
                type={field.includes("Time") || field === "signupDeadline" ? "datetime-local" : "text"}
                value={(form as any)[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{event ? "Save" : "Create"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
