import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CPTOverview from './Cptoverview';

/**
 * Beispiel: Admin Panel Page mit CPT-Übersicht
 * 
 * Diese Seite zeigt, wie die CPT-Komponente in ein bestehendes
 * Admin Panel integriert werden kann.
 */
const EventManagerAdminPage: React.FC = () => {
  // Diese Werte sollten aus deiner Konfiguration/Environment kommen
  const API_CONFIG = {
    trainingCPTURL: process.env.TRAINING_API_CPTS_URL || '',
    bearerToken: process.env.TRAINING_API_TOKEN || '',
  };

  // Deutsche FIRs
  const firs = [
    { code: 'EDGG', name: 'Langen' },
    { code: 'EDWW', name: 'Bremen' },
    { code: 'EDMM', name: 'München' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold">CPT Übersicht</h1>
          <p className="text-muted-foreground mt-1">
            Anstehende Checkouts nach FIR
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">Alle FIRs</TabsTrigger>
            {firs.map(fir => (
              <TabsTrigger key={fir.code} value={fir.code}>
                {fir.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab für alle CPTs */}
          <TabsContent value="all" className="space-y-4">
            <CPTOverview
              trainingCPTURL={API_CONFIG.trainingCPTURL}
              bearerToken={API_CONFIG.bearerToken}
            />
          </TabsContent>

          {/* Tabs für einzelne FIRs */}
          {firs.map(fir => (
            <TabsContent key={fir.code} value={fir.code} className="space-y-4">
              <CPTOverview
                trainingCPTURL={API_CONFIG.trainingCPTURL}
                bearerToken={API_CONFIG.bearerToken}
                firCode={fir.code}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};


export default EventManagerAdminPage;