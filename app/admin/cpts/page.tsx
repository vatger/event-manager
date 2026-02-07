import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CPTOverview from './Cptoverview';
import { getAllFIRCodes, getFIRConfig } from '@/config/firStations';
import { useUser } from '@/hooks/useUser';

/**
 * CPT Übersicht Admin Page
 * 
 * Zeigt alle anstehenden CPTs (Checkride Position Training) organisiert nach FIR.
 * Event-Koordinatoren können Benachrichtigungen aktivieren, um über neue,
 * gelöschte oder bestätigte CPTs informiert zu werden.
 */
export default async function CPTAdminPage() {
  const session = await getServerSession(authOptions);
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
          <CPTOverview/>
      </div>
    </div>
  );
}
