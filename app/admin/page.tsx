import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getAdminUser } from "../../lib/admin-auth";
import { AdminApp } from "./admin-app";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const identified = await requireChatGPTUser("/admin");
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <main className="admin-denied">
        <p className="eyebrow">Wake Church</p>
        <h1>Admin access is not enabled for {identified.email}.</h1>
        <p>Ask an administrator to add this email to the admin allowlist.</p>
        <a href={chatGPTSignOutPath("/admin")}>Sign in with another account</a>
      </main>
    );
  }
  return <AdminApp user={{ id: admin.id, name: admin.displayName, email: admin.email, isAdmin: admin.isAdmin, permissions: admin.permissions, groupIds: admin.groupIds }} signOutPath={chatGPTSignOutPath("/")} />;
}
