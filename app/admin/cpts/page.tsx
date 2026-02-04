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
  
  
  const API_CONFIG = {
    trainingCPTURL: process.env.TRAINING_API_CPTS_URL || '',
    bearerToken: process.env.TRAINING_API_TOKEN || '',
  };

  const firCodes = getAllFIRCodes();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
          <CPTOverview
            trainingCPTURL={API_CONFIG.trainingCPTURL}
            bearerToken={API_CONFIG.bearerToken}
            firCode={session?.user?.fir || undefined}
            userCID={session?.user?.id ? Number(session.user.id) : undefined}
          />
      </div>
    </div>
  );
}
