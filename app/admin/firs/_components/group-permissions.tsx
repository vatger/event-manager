'use client';

import { useState, useEffect } from 'react';
import { Group, Permission } from '@/types/fir';
import { firApi } from '@/lib/api/fir';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Save, Key, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getErrorMessage } from '@/utils/errorUtils';

interface GroupPermissionsProps {
  group: Group;
  firCode: string;
  canManage: boolean;
  onUpdate: () => void;
}

export function GroupPermissions({ group, firCode, canManage, onUpdate }: GroupPermissionsProps) {
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lade verfügbare Permissions
  useEffect(() => {
    loadAvailablePermissions();
  }, []);

  // Sync selected permissions when group or availablePermissions change
  useEffect(() => {
    if(!group.permissions) return;
    if (availablePermissions.length > 0 && group.permissions.length > 0) {
      // Erstelle Mapping von permission key zu ID
      const keyToIdMap = new Map(
        availablePermissions.map(perm => [perm.key, perm.id])
      );
      
      // Setze die ausgewählten Permission IDs basierend auf den Gruppenberechtigungen
      const selectedIds = new Set<number>();
      group.permissions.forEach(perm => {
        const permissionId = keyToIdMap.get(perm.key);
        if (permissionId) {
          selectedIds.add(permissionId);
        }
      });
      
      setSelectedPermissionIds(selectedIds);
    }
    setLoading(false);
  }, [availablePermissions, group.permissions]);

  const loadAvailablePermissions = async () => {
    try {
      setError(null);
      const permissions = await firApi.getAvailablePermissions();
      setAvailablePermissions(permissions);
    } catch (err) {
      console.error('Failed to load permissions:', err);
      setError('Berechtigungen konnten nicht geladen werden');
    }
  };

  const handlePermissionToggle = (permissionId: number) => {
    const newSelected = new Set(selectedPermissionIds);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissionIds(newSelected);
  };

  const handleSave = async () => {
    if (!canManage) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Bereite das Updates-Array im von der API erwarteten Format vor
      const updates = Array.from(selectedPermissionIds)
        .map(permissionId => {
          const permission = availablePermissions.find(p => p.id === permissionId);
          return permission ? {
            permissionId: permission.id,
            scope: "OWN_FIR" // Verwende den defaultScope aus der Datenbank
          } : null;
        })
        .filter(Boolean) as Array<{ permissionId: number; scope: string }>;

      await firApi.updateGroupPermissions(firCode, group.id, updates);
      onUpdate();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Berechtigungen konnten nicht gespeichert werden");
      console.error("Failed to update permissions:", message, err);
      setError(message);
    } finally {
      setSaving(false);
    }
    
  };

  const handleReset = () => {
    const keyToIdMap = new Map(
      availablePermissions.map(perm => [perm.key, perm.id])
    );
    const selectedIds = new Set<number>();
    if(!group.permissions) return;
    group.permissions.forEach(perm => {
      const permissionId = keyToIdMap.get(perm.key);
      if (permissionId) {
        selectedIds.add(permissionId);
      }
    });
    setSelectedPermissionIds(selectedIds);
    setError(null);
  };

  // Prüfe ob Änderungen vorliegen
  const currentPermissionIds = new Set(
    group.permissions!
      .map(perm => availablePermissions.find(p => p.key === perm.key)?.id)
      .filter(Boolean) as number[]
  );

  const hasChanges = 
    selectedPermissionIds.size !== currentPermissionIds.size ||
    !Array.from(currentPermissionIds).every(id => selectedPermissionIds.has(id));

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Lade Berechtigungen...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Berechtigungen</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie die Berechtigungen für diese Gruppe
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button 
              variant="outline" 
              onClick={handleReset}
              disabled={saving}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Zurücksetzen
            </Button>
          )}
          {canManage && (
            <Button 
              onClick={handleSave} 
              disabled={saving || !hasChanges}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4 mr-2" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {availablePermissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Key className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine Berechtigungen verfügbar</h3>
            <p className="text-muted-foreground text-center mb-4">
              Es konnten keine Berechtigungen geladen werden.
            </p>
            <Button onClick={loadAvailablePermissions} variant="outline">
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {availablePermissions.map((permission) => (
            <Card key={permission.id}>
              <CardContent className="pl-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {canManage ? (
                      <Checkbox
                        checked={selectedPermissionIds.has(permission.id)}
                        onCheckedChange={() => handlePermissionToggle(permission.id)}
                        disabled={saving}
                      />
                    ) : (
                      <Key className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{permission.key}</div>
                      <div className="text-sm text-muted-foreground">
                        {permission.description}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!canManage && (
        <div className="text-sm text-muted-foreground">
          Sie haben keine Berechtigung, die Berechtigungen dieser Gruppe zu ändern.
        </div>
      )}
    </div>
  );
}