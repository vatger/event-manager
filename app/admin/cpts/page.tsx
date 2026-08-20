import React from "react";
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <CptManager />
      </div>
    </div>
  );
}
