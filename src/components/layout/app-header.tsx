"use client";

import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { NotificationBell } from "@/modules/notifications/notification-bell";

import { HeaderSearch } from "./header-search";
import { UserMenu } from "./user-menu";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  image?: string | null;
};

/** Barra superior (sempre escura): menu, logo, busca, notificações e conta. */
export function AppHeader({ user }: { user: AppUser }) {
  const { toggleSidebar, open, openMobile, isMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;

  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-3 border-b border-bar-border bg-bar px-4 text-bar-foreground md:gap-4 md:px-6">
      <Button
        type="button"
        variant="ghost"
        onClick={toggleSidebar}
        aria-label={expanded ? "Recolher menu" : "Expandir menu"}
        aria-expanded={expanded}
        className="size-10 shrink-0 rounded-lg border border-bar-border bg-transparent p-0 text-bar-foreground transition-colors duration-200 hover:bg-bar-foreground/10 hover:text-bar-foreground focus-visible:ring-bar-foreground/60 motion-reduce:transition-none"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>
      <Link
        href="/"
        aria-label="IGEPPS — página inicial"
        className="shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-bar-foreground/60 focus-visible:outline-none"
      >
        <Image src="/brand/igepps-logo-light.png" alt="IGEPPS" width={592} height={190} priority className="h-9 w-auto" />
      </Link>
      <div className="flex min-w-0 flex-1 justify-center">
        <HeaderSearch />
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
