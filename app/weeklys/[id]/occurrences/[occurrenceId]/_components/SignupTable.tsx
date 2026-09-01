import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Users, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { isTrainee } from "@/lib/weeklys/traineeUtils";
import { getRatingFromValue } from "@/utils/ratingToValue";
import { AddSignupByCIDDialog } from "./AddSignupByCIDDialog";

interface User {
  cid: string;
  name: string;
  rating: number;
}

interface Signup {
  id: number;
  userCID: number;
  remarks: string | null;
  createdAt: string;
  user: User | null;
  endorsementGroup: string | null;
  restrictions: string[];
}

interface SignupsTableProps {
  signups: Signup[];
  loading: boolean;
  canManage: boolean;
  configId: number;
  occurrenceId: number;
  currentUserCID?: number;
  onSignupAdded: () => void;
  onEdit: (signup: Signup) => void;
  onDelete: (signup: Signup) => void;
}

export function SignupsTable({
  signups, loading, canManage, configId, occurrenceId,
  currentUserCID, onSignupAdded, onEdit, onDelete,
}: SignupsTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <CardTitle className="text-lg">Angemeldete Lotsen</CardTitle>
            <Badge variant="outline" className="ml-2">{signups.length}</Badge>
          </div>
          {canManage && (
            <AddSignupByCIDDialog
              configId={configId}
              occurrenceId={occurrenceId}
              onSignupAdded={onSignupAdded}
            />
          )}
        </div>
        <CardDescription>
          {signups.length === 1 ? "Ein Lotse hat sich angemeldet" : `${signups.length} Lotsen haben sich angemeldet`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : signups.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Noch keine Anmeldungen</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>CID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[120px]">Gruppe</TableHead>
                  <TableHead className="w-[200px]">Einschränkungen</TableHead>
                  <TableHead className="w-[120px]">Angemeldet seit</TableHead>
                  <TableHead className="w-[150px]">Bemerkungen</TableHead>
                  {canManage && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...signups]
                  .sort((a, b) => {
                    if (a.user?.rating !== b.user?.rating)
                      return (b.user?.rating || 0) - (a.user?.rating || 0);
                    return (a.user?.name || "").localeCompare(b.user?.name || "");
                  })
                  .map((signup) => {
                    const isCurrentUser = signup.userCID === currentUserCID;
                    return (
                      <TableRow key={signup.id} className={isCurrentUser ? "bg-primary-50 dark:bg-primary-900/10" : ""}>
                        <TableCell><span className="font-medium">{signup.userCID}</span></TableCell>
                        <TableCell><span className="font-medium">{signup.user?.name || "Unbekannt"}</span></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {signup.endorsementGroup ? (
                              <Badge className={cn("text-[10px] h-4", getBadgeClassForEndorsement(signup.endorsementGroup))}>
                                {signup.endorsementGroup}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                            {isTrainee(signup.restrictions) && (
                              <Badge className="text-[10px] h-4 bg-warning-600 text-warning-950 hover:bg-warning-700">Trainee</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {signup.restrictions?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {signup.restrictions.map((r, i) => (
                                <Badge key={i} variant="secondary" className="text-[8px] h-3 px-1">{r}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Keine</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(signup.createdAt), "dd.MM.yyyy", { locale: de })}
                          </span>
                        </TableCell>
                        <TableCell>
                          {signup.remarks ? (
                            <span className="text-xs text-muted-foreground italic line-clamp-1">{signup.remarks}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEdit(signup)}>
                                  <Pencil className="mr-2 h-4 w-4" />Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(signup)} className="text-danger-700 dark:text-danger-300">
                                  <Trash2 className="mr-2 h-4 w-4" />Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}