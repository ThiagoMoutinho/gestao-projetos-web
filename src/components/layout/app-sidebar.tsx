"use client";

import { ChevronRight, ChevronsUpDown, Loader2, LogOut, Network } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { logout } from "@/modules/auth/client";
import { roleLabel } from "@/modules/auth/roles";

import type { AppUser } from "./app-header";
import { APP_NAV_GROUPS, type AppNavChild, type AppNavItem } from "./app-nav";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function itemTooltip(label: string, enabled: boolean) {
  return enabled ? label : `${label}, indisponível`;
}

function NavSubItem({ item, pathname }: { item: AppNavChild; pathname: string }) {
  const active = item.enabled && item.href === pathname;

  if (item.enabled && item.href) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton isActive={active} render={<Link href={item.href} />}>
          <span>{item.label}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton aria-disabled="true" className="aria-disabled:pointer-events-auto">
        <span>
          {item.label}
          <span className="sr-only">, indisponível</span>
        </span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function NavItem({ item, pathname }: { item: AppNavItem; pathname: string }) {
  const Icon = item.icon;
  const active =
    item.enabled &&
    item.href !== undefined &&
    (item.href === pathname || (item.href !== "/" && pathname.startsWith(`${item.href}/`)));
  const children = item.children ?? [];

  if (children.length > 0) {
    return (
      <Collapsible className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger
            render={
              <SidebarMenuButton tooltip={itemTooltip(item.label, item.enabled)} />
            }
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
            <ChevronRight className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {children.map((child) => (
                <NavSubItem key={child.label} item={child} pathname={pathname} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      {item.enabled && item.href ? (
        <SidebarMenuButton
          isActive={active}
          tooltip={item.label}
          render={<Link href={item.href} />}
        >
          <Icon className="size-4 shrink-0" />
          <span>{item.label}</span>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          aria-disabled="true"
          tooltip={itemTooltip(item.label, false)}
          className="aria-disabled:pointer-events-auto"
        >
          <Icon className="size-4 shrink-0" />
          <span>
            {item.label}
            <span className="sr-only">, indisponível</span>
          </span>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

function UserIdentity({
  user,
  tone,
  role,
}: {
  user: AppUser;
  tone: "sidebar" | "menu";
  role?: string;
}) {
  return (
    <>
      <Avatar className="size-8 rounded-lg after:rounded-lg">
        <AvatarFallback className="rounded-lg bg-primary text-xs font-medium text-primary-foreground">
          {initials(user.name)}
        </AvatarFallback>
      </Avatar>
      <span
        className={
          tone === "sidebar"
            ? "grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden"
            : "grid min-w-0 flex-1 text-left text-sm leading-tight"
        }
      >
        <span className={tone === "menu" ? "truncate font-medium text-foreground" : "truncate font-medium"}>
          {user.name}
        </span>
        <span
          className={
            tone === "sidebar"
              ? "truncate text-xs text-sidebar-foreground/75"
              : "truncate text-xs text-muted-foreground"
          }
        >
          {user.email}
        </span>
        {role ? <span className="truncate text-xs text-muted-foreground">{role}</span> : null}
      </span>
    </>
  );
}

function SidebarUser({ user }: { user: AppUser }) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [pending, setPending] = useState(false);
  const profile = roleLabel(user.role);

  async function onLogout() {
    if (pending) {
      return;
    }

    setPending(true);
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={user.name}
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground group-data-[collapsible=icon]:p-0!"
              />
            }
          >
            <UserIdentity user={user} tone="sidebar" />
            <ChevronsUpDown className="ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <span className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <UserIdentity user={user} tone="menu" role={profile} />
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={pending} onClick={() => void onLogout()}>
              {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

const SELECTED_PROJECT_KEY = "igepps.selectedProjectId";

function EapNavItem({ pathname, eapOpen }: { pathname: string; eapOpen: boolean }) {
  const router = useRouter();
  const currentProject = pathname.match(/^\/projetos\/([^/]+)$/)?.[1];
  const active = Boolean(currentProject && eapOpen);

  function openEap() {
    const stored = currentProject ?? window.sessionStorage.getItem(SELECTED_PROJECT_KEY);
    if (stored) {
      router.push(`/projetos/${stored}?aba=eap`);
      return;
    }
    router.push("/projetos?aviso=eap");
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Projeto</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton isActive={active} tooltip="Estrutura Analítica do Projeto" onClick={openEap}>
              <Network className="size-4 shrink-0" />
              <span>EAP</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ user }: { user: AppUser }) {
  const pathname = usePathname();
  const eapOpen = useSearchParams().get("aba") === "eap";
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="overflow-hidden group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex h-15 items-center group-data-[collapsible=icon]:justify-center">
          <Image
            src="/brand/igepps-logo.png"
            alt="IGEPPS — Instituto de Gestão Previdenciária e Proteção Social do Estado do Pará"
            width={218}
            height={85}
            className="h-13 w-auto max-w-full object-contain object-left group-data-[collapsible=icon]:hidden"
          />
          <Tooltip>
            <TooltipTrigger
              className="hidden size-8 items-center justify-center rounded-md group-data-[collapsible=icon]:flex"
              aria-label="IGEPPS"
            >
              <Image
                src="/brand/igepps-mark.png"
                alt=""
                width={70}
                height={66}
                className="size-7 object-contain"
              />
            </TooltipTrigger>
            <TooltipContent side="right" hidden={state !== "collapsed"}>
              IGEPPS
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="leading-tight group-data-[collapsible=icon]:hidden">
          <p className="truncate text-sm font-semibold tracking-wide">CTIN</p>
          <p className="truncate text-[0.65rem] font-medium tracking-[0.14em] text-sidebar-foreground/75">
            GESTÃO DE PROJETOS
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {APP_NAV_GROUPS.map((group) => (
          <Fragment key={group.label}>
          {group.label === "Gestão" ? <EapNavItem pathname={pathname} eapOpen={eapOpen} /> : null}
          <SidebarGroup>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => (
                  <NavItem key={item.label} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          </Fragment>
        ))}
      </SidebarContent>
      <SidebarFooter className="shrink-0">
        <SidebarUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
