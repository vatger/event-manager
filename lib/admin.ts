export async function checkAdminAccess(cid: string): Promise<boolean> {
  if (!cid) return false;
  try {
    const params = new URLSearchParams({ cid });
    const res = await fetch(`/api/admin/access?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data: { isAdmin: boolean } = await res.json();
    return !!data.isAdmin;
  } catch (_) {
    return false;
  }
}
