import { getAdminIdentity } from "../../lib/admin-identity";
import { getAdminUser } from "../../lib/admin-auth";
import { AdminApp } from "./admin-app";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const identified = await getAdminIdentity();
  if (!identified) {
    return (
      <main className="admin-denied">
        <p className="eyebrow">Wake Church</p>
        <h1>Admin authentication is required.</h1>
        <p>Sign in through your organization&apos;s SAML provider and try again.</p>
      </main>
    );
  }

  const admin = await getAdminUser();
  if (!admin) {
    return (
      <main className="admin-denied">
        <p className="eyebrow">Wake Church</p>
        <h1>Admin access is not enabled for {identified.email}.</h1>
        <p>Ask an administrator to add this email to an access group.</p>
      </main>
    );
  }

  return <AdminApp user={{ id: admin.id, name: admin.displayName, email: admin.email, isAdmin: admin.isAdmin, permissions: admin.permissions, groupIds: admin.groupIds }} />;
}
