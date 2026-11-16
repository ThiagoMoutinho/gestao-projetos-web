"use client";

import type { CSSProperties } from "react";

import { AccessibleProjectsProvider } from "./accessible-projects";
import { AppBreadcrumb } from "./app-breadcrumb";
import { AppHeader, type AppUser } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PageTransitionProvider } from "@/components/layout/page-transition";
import { AppearanceProvider } from "@/modules/appearance/appearance-provider";

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
    <PageTransitionProvider>
    <AppearanceProvider userId={user.id}>
    <AccessibleProjectsProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        style={{ "--header-height": "4.34rem", "--sidebar-width": "16.5rem", "--sidebar-width-icon": "4.5rem" } as CSSProperties}
        className="min-h-svh flex-1 flex-col bg-background"
      >
        <AppHeader user={user} />
        <div className="flex min-w-0 flex-1">
          <AppSidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" />
          <SidebarInset className="min-w-0 bg-transparent">
            <AppBreadcrumb />
            <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-2 md:p-6 md:pt-2">{children}</div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AccessibleProjectsProvider>
    </AppearanceProvider>
    </PageTransitionProvider>
  );
}
