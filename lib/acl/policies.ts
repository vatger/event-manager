import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeEffectiveData } from "./effective";

export { computeEffectiveData } from "./effective";
export type { EffectiveData, EffectiveLevel, FirLevel } from "./effective";

const userAclInclude = {
  fir: true,
  vatgerLeitung: true,
  groups: {
    include: {
      group: {
        include: {
          fir: true,
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithAll = Prisma.UserGetPayload<{ include: typeof userAclInclude }>;

/** Lädt einen Nutzer samt Gruppen und berechnet seine Rollen und Rechte. */
export async function getUserWithEffectiveData(cid: number) {
  const user = await prisma.user.findUnique({
    where: { cid },
    include: userAclInclude,
  });

  if (!user) return null;
  return { ...user, ...computeEffectiveData(user) };
}

export type UserWithEffectiveData = NonNullable<
  Awaited<ReturnType<typeof getUserWithEffectiveData>>
>;
