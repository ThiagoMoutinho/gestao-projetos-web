import { redirect } from "next/navigation";

import { LogoutButton } from "@/modules/auth/logout-button";
import { roleLabel } from "@/modules/auth/roles";
import { getServerSession } from "@/modules/auth/session";

export default async function Home() {
  const session = await getServerSession();
  const user = session.data?.user;

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-lg space-y-6 rounded-xl border border-border bg-card p-8 text-card-foreground">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Área interna</p>
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium break-all">{user.email}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Perfil</dt>
            <dd className="font-medium">{roleLabel(user.role)}</dd>
          </div>
        </dl>
        <LogoutButton />
      </section>
    </main>
  );
}
