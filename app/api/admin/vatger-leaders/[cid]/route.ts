import { getSessionUser } from "@/lib/getSessionUser";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ cid: string }> }) {
    const user = await getSessionUser();
    if (!user || user.role !== "MAIN_ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { cid: paramcid } = await params;
    const cid = Number(paramcid);
    if (!cid) {
        return NextResponse.json({ error: "CID required" }, { status: 400 });
    }
    const userToAdd = await prisma.user.findUnique({
        where: { cid: Number(cid) },
    });
    if (!userToAdd) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prüfen, ob bereits in VatgerLeitung
    const existing = await prisma.vATGERLeitung.findUnique({
        where: { userCID: cid },
    });

    if (existing) {
        return NextResponse.json({ error: "User is already a VATGER Leader" }, { status: 400 });
    }

    // Hinzufügen
    const newLeader = await prisma.vATGERLeitung.create({
        data: { userCID: cid },
    });

    return NextResponse.json(newLeader, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ cid: string }> }) {
    const user = await getSessionUser();
    if (!user || user.role !== "MAIN_ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { cid: paramcid } = await params;
    const cid = Number(paramcid);
    if (!cid) {
        return NextResponse.json({ error: "CID required" }, { status: 400 });
    }
    
    const existing = await prisma.vATGERLeitung.findUnique({
        where: { userCID: cid },
    });
    
    if (!existing) {
        return NextResponse.json({ error: "User is not in VATGER Leitung" }, { status: 404 });
    }

    await prisma.vATGERLeitung.delete({ where: { userCID: cid } });

    return NextResponse.json({ success: true }, { status: 200 });
}