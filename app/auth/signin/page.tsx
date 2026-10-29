// app/signin/page.tsx
import { getServerSession } from "next-auth";
import SignInClient, { LocalTestLogin } from "./SignInClient";
import { isLocalTestMode } from "@/lib/localTest/mode";
import { LOCAL_TEST_USERS } from "@/lib/localTest/fixtures";
import { prisma } from "@/lib/prisma";

async function loadLocalTestLogins(): Promise<LocalTestLogin[]> {
  const roles = new Map(LOCAL_TEST_USERS.map((u) => [u.cid, u.role]));
  const users = await prisma.user.findMany({
    select: { cid: true, name: true, rating: true },
    orderBy: { cid: "asc" },
  });
  return users.map((u) => ({ ...u, role: roles.get(u.cid) }));
}

export default async function SignInPage() {
  const session = await getServerSession();
  const localTestLogins = isLocalTestMode() ? await loadLocalTestLogins() : null;

  return (
    <SignInClient
      session={session}
      isDevMode={process.env.DEV_MODE === "true"}
      localTestLogins={localTestLogins}
    />
  );
}
