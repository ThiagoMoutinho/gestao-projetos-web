import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE_NAME } from "@/components/layout/sidebar-state";
import { getServerSession } from "@/modules/auth/session";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const user = session.data?.user;

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== "false";

  return (
    <AppShell
      defaultOpen={sidebarOpen}
      user={{ name: user.name, email: user.email, role: user.role }}
    >
      {children}
    </AppShell>
  );
}
