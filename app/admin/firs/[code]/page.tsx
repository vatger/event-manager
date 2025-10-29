'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { firApi } from '@/lib/api/fir';
import { FIR, CurrentUser, Group } from '@/types/fir';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users, Key, ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';
import { FIRNavbar } from '../_components/FIRnavbar';
import { GroupMembers } from '../_components/group-members';
import { GroupPermissions } from '../_components/group-permissions';

export default function FIRDetailPage() {
  const params = useParams();
  const firCode = params.code as string;
  
  const [fir, setFir] = useState<FIR | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('groups');

  useEffect(() => {
    loadData();
  }, [firCode]);

  const loadData = async () => {
    try {
      const [userData, firsData] = await Promise.all([
        firApi.getCurrentUser(),
        firApi.getFIRs()
      ]);
      
      setCurrentUser(userData);
      const currentFIR = firsData.find(f => f.code === firCode);
      setFir(currentFIR || null);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const canManageFIR = currentUser?.effectiveLevel === 'MAIN_ADMIN' || 
                      currentUser?.effectiveLevel === 'VATGER_LEITUNG' ||
                      (currentUser?.effectiveLevel === 'FIR_EVENTLEITER' && 
                       currentUser.fir?.code === firCode);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }
  if (!fir) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">FIR nicht gefunden</h1>
          <div className="flex gap-2 justify-center mt-4">
            <Link href="/admin/firs">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zur Übersicht
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <FIRNavbar />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Link href="/admin/firs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-3xl font-bold">{fir.code}</h1>
          <p className="text-muted-foreground">{fir.name}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="groups">
            <Users className="w-4 h-4 mr-2" />
            Gruppen & Mitglieder
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Key className="w-4 h-4 mr-2" />
            Berechtigungen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-6">
          {fir.groups?.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {group.name}
                    <Badge variant={
                      group.kind === 'FIR_LEITUNG' ? 'default' : 'secondary'
                    }>
                      {group.kind}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    {group.members?.length} Mitglieder
                  </div>
                </CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <GroupMembers
                  group={group}
                  firCode={fir.code}
                  canManage={canManageFIR}
                  VATGERStaff={currentUser?.effectiveLevel == "VATGER_LEITUNG" || currentUser?.effectiveLevel == "MAIN_ADMIN"}
                  onUpdate={loadData}
                />
                
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          {fir.groups?.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle>{group.name}</CardTitle>
                <CardDescription>
                  Berechtigungen für {group.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GroupPermissions
                  group={group}
                  firCode={fir.code}
                  canManage = {canManageFIR
                                && (
                                    group.kind !== "FIR_LEITUNG" ||
                                    (currentUser.effectiveLevel === "MAIN_ADMIN" || currentUser.effectiveLevel === "VATGER_LEITUNG")
                                  )}
                  onUpdate={loadData}
                />
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}