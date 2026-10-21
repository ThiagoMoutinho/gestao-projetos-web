"use client";

import { AppHeader, type AppUser } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function AppShell({
  user,
  children,
  defaultOpen,
}: {
  user: AppUser;
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="min-h-svh flex-1 bg-[color-mix(in_oklch,var(--background),var(--primary)_4%)]"
    >
      <AppSidebar user={user} />
      <SidebarInset className="min-w-0 bg-transparent">
        <AppHeader />
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
