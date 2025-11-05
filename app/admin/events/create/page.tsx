"use client";

import { useUser } from "@/hooks/useUser";
import AdminEventForm from "../_components/AdminEventForm";

export default function CreateEventPage() {

  const { user, canInOwnFIR, isVATGERLead } = useUser()

  if (!user || (!user.fir && !isVATGERLead()) || (!isVATGERLead() && !canInOwnFIR('event.create'))) {
    console.log(isVATGERLead(), user, user?.fir, canInOwnFIR('event.create'));
    return (
      <div className="container mx-auto max-w-3xl py-8">
        <p className="text-center text-red-600">You are not allowed to create Events</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">

      <AdminEventForm
        event={null}
        fir={user.fir}
      />
    </div>
  );
}
