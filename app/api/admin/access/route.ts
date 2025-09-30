import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/admin/access?cid=XXXX
// Returns: { isAdmin: boolean, role: "USER" | "ADMIN" | "MAIN_ADMIN" | null }
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cidParam = url.searchParams.get("cid");

    if (!cidParam) {
      return NextResponse.json(
        { isAdmin: false, role: null, error: "CID required" },
        { status: 400 }
      );
    }

    const cid = Number(cidParam);
    if (!Number.isFinite(cid)) {
      return NextResponse.json(
        { isAdmin: false, role: null, error: "Invalid CID" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { cid } });

    const role = user?.role ?? null;
    const isAdmin = role === "ADMIN" || role === "MAIN_ADMIN";

    return NextResponse.json({ isAdmin, role });
  } catch (error) {
    console.error("/api/admin/access GET error:", error);
    return NextResponse.json(
      { isAdmin: false, role: null, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
