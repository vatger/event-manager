import { NextResponse } from "next/server";
import { loadDepartment, requireDepartment } from "@/lib/acl/teamService";

/**
 * GET /api/firs/[code]
 * Das Eventdepartment einer FIR: Gruppen mit Mitgliedern und Rechten.
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const ctx = await requireDepartment(code);
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json(await loadDepartment(ctx));
}
