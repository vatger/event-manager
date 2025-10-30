'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firApi } from '@/lib/api/fir';
import { FIR } from '@/types/fir';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Settings, Home } from 'lucide-react';
import Link from 'next/link';
import { CreateFIRDialog } from './_components/create-fir-dialog';
import { DeleteFIRDialog } from './_components/delete-fir-dialog';
import { FIRNavbar } from './_components/FIRnavbar';
import { useUser } from '@/hooks/useUser';

export default function FIRsPage() {
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const router = useRouter();
  const { isVATGERLead } = useUser();
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setFirs(await firApi.getFIRs());
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">FIR Management</h1>
          <p className="text-muted-foreground">
            Verwalten Sie FIRs, Gruppen und Berechtigungen
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/">
            <Button variant="outline">
              <Home className="w-4 h-4 mr-2" />
              Hauptseite
            </Button>
          </Link>
          {isVATGERLead() && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Neue FIR erstellen
            </Button>
          )}
        </div>
      </div>

      {firs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine FIRs gefunden</h3>
            <p className="text-muted-foreground text-center mb-4">
              Es wurden noch keine FIRs in System konfiguriert.
              {isVATGERLead() && ' Erstellen Sie die erste FIR um zu beginnen.'}
            </p>
            {isVATGERLead() && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Erste FIR erstellen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {firs.map((fir) => (
            <Card key={fir.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {fir.code}
                      <Badge variant="secondary">{fir.name}</Badge>
                    </CardTitle>
                    <CardDescription>
                      {fir.groups?.length} Gruppen •{' '}
                      {fir.groups?.reduce((acc, group) => acc + (group.members ? group.members?.length : 0), 0)} Mitglieder
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/firs/${fir.code}`)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Verwalten
                    </Button>
                    {isVATGERLead() && (
                      <DeleteFIRDialog fir={fir} onDelete={loadData} />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gruppe</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Mitglieder</TableHead>
                      <TableHead>Berechtigungen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fir.groups?.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>
                          <Badge variant={
                            group.kind === 'FIR_LEITUNG' ? 'default' : 'secondary'
                          }>
                            {group.kind}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            {group.members?.length}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {group.permissions?.slice(0, 3).map((permission) => (
                              <Badge key={permission.key} variant="outline" className="text-xs">
                                {permission.key}
                              </Badge>
                            ))}
                            {group.permissions!.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{group.permissions!.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreateDialog && (
        <CreateFIRDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={() => {
            setShowCreateDialog(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}