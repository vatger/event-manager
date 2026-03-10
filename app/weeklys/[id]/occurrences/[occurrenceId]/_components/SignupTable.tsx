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
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />
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
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : signups.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Noch keine Anmeldungen</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-900/40">
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
                      <TableRow key={signup.id} className={isCurrentUser ? "bg-blue-50 dark:bg-blue-900/10" : ""}>
                        <TableCell><span className="font-medium">{signup.userCID}</span></TableCell>
                        <TableCell><span className="font-medium">{signup.user?.name || "Unbekannt"}</span></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {signup.endorsementGroup ? (
                              <Badge className={cn("text-[10px] h-4", getBadgeClassForEndorsement(signup.endorsementGroup))}>
                                {signup.endorsementGroup}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600 text-xs">-</span>
                            )}
                            {isTrainee(signup.restrictions) && (
                              <Badge className="text-[10px] h-4 bg-yellow-500 hover:bg-yellow-600 text-black">Trainee</Badge>
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
                            <span className="text-gray-400 dark:text-gray-600 text-xs">Keine</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {format(new Date(signup.createdAt), "dd.MM.yyyy", { locale: de })}
                          </span>
                        </TableCell>
                        <TableCell>
                          {signup.remarks ? (
                            <span className="text-xs text-gray-600 dark:text-gray-400 italic line-clamp-1">{signup.remarks}</span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600 text-xs">-</span>
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
                                <DropdownMenuItem onClick={() => onDelete(signup)} className="text-red-600">
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