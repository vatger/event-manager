import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import AdminShell from "./AdminShell";
import { userHasPermission } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const me = await prisma.user.findUnique({ where: { cid: Number(session.user.cid) } });
  if (!me) redirect("/");

  const allowed =
    me.role === "MAIN_ADMIN" ||
    (await userHasPermission(me.cid, "admin.access"));

  if (!allowed) redirect("/");
  return (
    <AdminShell
      user={{
        name: session.user.name,
        cid: String(session.user.cid),
      }}
    >
      {children}
    </AdminShell>
  );
}
