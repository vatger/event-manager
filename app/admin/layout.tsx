import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Server-seitige Admin-Prüfung ohne Client-Flash
  const cid = Number(session.user.cid);
  const dbUser = await prisma.user.findUnique({ where: { cid }, select: { role: true, name: true, cid: true } });

  const role = dbUser?.role ?? "USER";
  if (role !== "ADMIN" && role !== "MAIN_ADMIN") {
    redirect("/");
  }

  return (
    <AdminShell
      user={{
        name: session.user.name,
        cid: String(session.user.cid),
        role,
      }}
    >
      {children}
    </AdminShell>
  );
}
