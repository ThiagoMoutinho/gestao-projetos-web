"use client";

import { ListIndentDecrease, ListIndentIncrease } from "lucide-react";
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
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-3 border-b border-bar-border bg-bar pr-4 text-bar-foreground md:gap-4 md:pr-6">
      {/* Mesma largura do menu recolhido: o botão fica centrado sobre a coluna de ícones. */}
      <div className="flex w-16 shrink-0 justify-center md:w-(--sidebar-width-icon)">
      <Button
        type="button"
        variant="ghost"
        onClick={toggleSidebar}
        aria-label={expanded ? "Recolher menu" : "Expandir menu"}
        aria-expanded={expanded}
        className="size-10 shrink-0 border border-bar-border bg-bar-foreground/6 p-0 text-bar-foreground transition-colors duration-200 hover:bg-bar-foreground/12 hover:text-bar-foreground aria-expanded:bg-bar-foreground/6 aria-expanded:text-bar-foreground dark:hover:bg-bar-foreground/12 focus-visible:ring-bar-foreground/60 motion-reduce:transition-none"
      >
        {expanded ? (
          <ListIndentDecrease className="size-5" aria-hidden="true" />
        ) : (
          <ListIndentIncrease className="size-5" aria-hidden="true" />
        )}
      </Button>
      </div>
      <Link
        href="/"
        aria-label="IGEPPS — página inicial"
        className="shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-bar-foreground/60 focus-visible:outline-none"
      >
        <Image src="/brand/igepps-logo-light.png" alt="IGEPPS" width={592} height={190} priority className="h-9 w-auto -translate-y-[3px]" />
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
