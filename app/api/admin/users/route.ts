// Dieser Endpunkt gibt die anzahl aller Nutzer in der UserDB zurück, sowie alle Nutzer die sich in den letzten 7 Tagen registriert haben. Er ist nur für Main Admins zugänglich.
// GET /api/admin/users

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { isMainAdmin } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!prisma) {
        return new Response("Service unavailable", { status: 503 });
    }
    if (isMainAdmin(Number(user.cid))) {
        const totalUsers = await prisma.user.count();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentUsers = await prisma.user.count({
            where: {
                createdAt: {
                    gte: sevenDaysAgo,
                },
            },
        });
        return NextResponse.json({ totalUsers, recentUsers });
    } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
}
