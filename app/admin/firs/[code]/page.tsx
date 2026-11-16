import { redirect } from "next/navigation";

export default async function LegacyFirDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/admin/team/${encodeURIComponent(code)}`);
}
