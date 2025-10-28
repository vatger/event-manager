import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) redirect("/auth/signin");

  const cid = Number(session.user.id);

  const hasAccess = await userHasPermission(cid, "admin.access");
  if (!hasAccess) redirect("/");

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
