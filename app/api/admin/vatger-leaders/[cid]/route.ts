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

    const VATGERgroup = await prisma.group.findMany({
        where: { kind: "GLOBAL_VATGER_LEITUNG" },
    });

    const existingMembership = await prisma.userGroup.findFirst({
        where: {
            userCID: Number(cid),
            groupId: VATGERgroup[0].id,
        },
    });
    
    if (existingMembership) {
        return NextResponse.json({ error: "User is already in VATGER Eventleitung group" },
            { status: 400 }
        );
    }

    const updatedUser = await prisma.userGroup.create({
        data: {
            userCID: Number(cid),
            groupId: VATGERgroup[0].id,
        },
    });

    return NextResponse.json(updatedUser, { status: 201 });
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
    
    const VATGERgroup = await prisma.group.findMany({
        where: { kind: "GLOBAL_VATGER_LEITUNG" },
    });

    const existingMembership = await prisma.userGroup.findFirst({
        where: {
            userCID: Number(cid),
            groupId: VATGERgroup[0].id,
        },
    });
    
    if (!existingMembership) {
        return NextResponse.json({ error: "User does not exist in this group" },
            { status: 400 }
        );
    }

    await prisma.userGroup.deleteMany({
        where: { userCID: Number(cid), groupId: VATGERgroup[0].id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
}