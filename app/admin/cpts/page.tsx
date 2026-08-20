import React from "react";
import Protected from "@/components/Protected";
import { CptManager } from "./_components/CptManager";

/**
 * CPT Manager
 *
 * Zeigt die von der ATD angesetzten CPTs je FIR und hält fest, welche davon
 * bereits im Forum beworben wurden. Verantwortliche pro FIR bekommen drei
 * Tage vor dem CPT eine Erinnerung und – solange nichts gepostet ist – am
 * Tag des CPTs noch einmal eine Nachfassung.
 */
export default function CPTAdminPage() {
  return (
    <Protected>
      <CptManager />
    </Protected>
  );
}
