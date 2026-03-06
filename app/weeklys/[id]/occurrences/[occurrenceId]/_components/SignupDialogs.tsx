import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle, Trash2 } from "lucide-react";

interface Signup {
  id: number;
  userCID: number;
  remarks: string | null;
  user: { cid: string; name: string; rating: number } | null;
}

interface SignupDialogsProps {
  editState: { open: boolean; signup: Signup | null };
  deleteState: { open: boolean; signup: Signup | null };
  editRemarks: string;
  busy: boolean;
  onEditRemarksChange: (val: string) => void;
  onEditClose: () => void;
  onDeleteClose: () => void;
  onEditConfirm: () => void;
  onDeleteConfirm: () => void;
}

export function SignupDialogs({
  editState, deleteState, editRemarks, busy,
  onEditRemarksChange, onEditClose, onDeleteClose,
  onEditConfirm, onDeleteConfirm,
}: SignupDialogsProps) {
  return (
    <>
      <Dialog open={editState.open} onOpenChange={(open) => !open && onEditClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anmeldung bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeite die Anmeldung von {editState.signup?.user?.name || `CID ${editState.signup?.userCID}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="remarks">Bemerkungen</Label>
              <Textarea
                id="remarks"
                value={editRemarks}
                onChange={(e) => onEditRemarksChange(e.target.value)}
                placeholder="Optional: Bemerkungen zur Anmeldung"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{editRemarks.length}/500 Zeichen</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onEditClose} disabled={busy}>Abbrechen</Button>
            <Button onClick={onEditConfirm} disabled={busy}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Speichert...</> : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteState.open} onOpenChange={(open) => !open && onDeleteClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anmeldung löschen</DialogTitle>
            <DialogDescription>
              Möchtest du die Anmeldung von {deleteState.signup?.user?.name || `CID ${deleteState.signup?.userCID}`} wirklich löschen?
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-700 dark:text-red-300">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={onDeleteClose} disabled={busy}>Abbrechen</Button>
            <Button variant="destructive" onClick={onDeleteConfirm} disabled={busy}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Löscht...</> : <><Trash2 className="mr-2 h-4 w-4" />Löschen</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}