'use client';

import { useState } from 'react';
import { FIR } from '@/types/fir';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, AlertTriangle } from 'lucide-react';

interface DeleteFIRDialogProps {
  fir: FIR;
  onDelete: () => void;
}

export function DeleteFIRDialog({ fir, onDelete }: DeleteFIRDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Hier würdest du die DELETE API aufrufen
      // await firApi.deleteFIR(fir.code);
      console.log('Deleting FIR:', fir.code);
      onDelete();
      setOpen(false);
    } catch (error) {
      console.error('Failed to delete FIR:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              FIR löschen
            </DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie die FIR <strong>{fir.code} - {fir.name}</strong> löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden und alle zugehörigen Gruppen und Berechtigungen werden entfernt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? 'Wird gelöscht...' : 'FIR löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}