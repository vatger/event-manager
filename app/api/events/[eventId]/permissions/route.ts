import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/getSessionUser";
import { canManageEventTasks, canManageEventBanner, isEventFirTeamMember, userhasPermissiononEvent } from "@/lib/acl/permissions";

/**
 * GET /api/events/[eventId]/permissions
 * Returns the current user's permission levels for this event.
 * Used by the frontend to conditionally show/hide UI elements.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { eventId } = await params;
  const evId = Number(eventId);
  const cid = Number(user.cid);

  const [canEdit, canManageTasks, canBanner, isTeamMember] = await Promise.all([
    userhasPermissiononEvent(cid, evId, "event.edit"),
    canManageEventTasks(cid, evId),
    canManageEventBanner(cid, evId),
    isEventFirTeamMember(cid, evId),
  ]);

  return NextResponse.json({
    canEdit,
    canManageTasks,
    canBanner,
    isTeamMember,
  });
}
