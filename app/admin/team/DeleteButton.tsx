import { Button } from '@/components/ui/button'
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import React from 'react'

export async function DeleteButton({removeAdmin}: {removeAdmin: (cid: string) => void}) {
    const session = await getServerSession(authOptions);
    const cid = Number(session!.user.cid);
    const dbUser = await prisma.user.findUnique({ where: { cid }, select: { role: true, name: true, cid: true } });
    const role = dbUser?.role ?? "USER";
    return (
    <Button
        variant="destructive"
        size="sm"
        onClick={() => {removeAdmin; console.log("remove")}}
        disabled={role !== "MAIN_ADMIN"}
    >
        Remove
    </Button>
  )
}

export default DeleteButton
