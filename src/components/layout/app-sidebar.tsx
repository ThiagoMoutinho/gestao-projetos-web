"use client";

import {
  CalendarDays,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  Flag,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Network,
  PanelLeftClose,
  Users,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

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
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ComboOption } from "@/components/option-combobox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { listProjects } from "@/lib/api/generated/projetos/projetos";
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

/** Projetos que o usuário pode acessar (a API aplica as permissões); null enquanto carrega ou se a consulta falhar. */
function useAccessibleProjects() {
  const [projects, setProjects] = useState<ComboOption[] | null>(null);

  useEffect(() => {
    let active = true;
    listProjects()
      .then((response) => {
        if (active && response.status === 200) {
          setProjects(
            response.data.data
              .map((project) => ({ value: project.id, label: project.name }))
              .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return projects;
}

const PROJECT_NAV_UNAVAILABLE: ReadonlyArray<{ label: string; icon: LucideIcon }> = [
  { label: "Cronograma", icon: CalendarDays },
  { label: "Entregas e Homologações", icon: Flag },
  { label: "Histórico Executivo", icon: History },
  { label: "Documentos", icon: FileText },
  { label: "Equipe", icon: Users },
];

/** Itens do projeto: só habilitados quando a rota aponta para um projeto acessível (`projectId`). */
function ProjectNav({ projectId, eapOpen }: { projectId: string | undefined; eapOpen: boolean }) {
  const router = useRouter();
  const eapActive = Boolean(projectId && eapOpen);
  const overviewActive = Boolean(projectId && !eapOpen);
  const disabledProps = { "aria-disabled": true } as const;

  function open(aba?: "eap") {
    if (projectId) {
      router.push(`/projetos/${projectId}${aba ? `?aba=${aba}` : ""}`);
    }
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Projeto</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                className={cn("cursor-pointer", !projectId && "aria-disabled:pointer-events-auto")}
                isActive={overviewActive}
                tooltip={projectId ? "Visão Geral" : "Visão Geral, selecione um projeto"}
                onClick={() => open()}
                {...(projectId ? {} : disabledProps)}
              >
                <LayoutDashboard className="size-4 shrink-0" />
                <span>Visão Geral</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className={cn("cursor-pointer", !projectId && "aria-disabled:pointer-events-auto")}
                isActive={eapActive}
                tooltip={projectId ? "Estrutura Analítica do Projeto" : "EAP, selecione um projeto"}
                onClick={() => open("eap")}
                {...(projectId ? {} : disabledProps)}
              >
                <Network className="size-4 shrink-0" />
                <span>EAP</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {PROJECT_NAV_UNAVAILABLE.map(({ label, icon: Icon }) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton tooltip={`${label}, indisponível`} {...disabledProps}>
                  <Icon className="size-4 shrink-0" />
                  <span>
                    {label}
                    <span className="sr-only">, indisponível</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

function ProjectSwitcher({
  projects,
  currentProject,
  eapOpen,
}: {
  projects: ComboOption[] | null;
  currentProject: string | undefined;
  eapOpen: boolean;
}) {
  const router = useRouter();
  const selected = projects?.find((option) => option.value === currentProject) ?? null;

  function select(id: string) {
    if (!id || id === currentProject) {
      return;
    }
    router.push(`/projetos/${id}${eapOpen ? "?aba=eap" : ""}`);
  }

  if (projects === null || projects.length === 0) {
    return null;
  }

  return (
    <div className="group-data-[collapsible=icon]:hidden">
      <Combobox
        items={projects}
        value={selected}
        onValueChange={(next: ComboOption | null) => select(next?.value ?? "")}
        itemToStringLabel={(option: ComboOption) => option.label}
        isItemEqualToValue={(item: ComboOption, current: ComboOption) => item.value === current.value}
      >
        <ComboboxTrigger
          aria-label="Selecionar projeto"
          className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent p-2.5 text-left text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent/80 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none [&>svg]:ml-auto [&>svg]:shrink-0 [&>svg]:text-sidebar-foreground/80"
        >
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-[10px] text-sidebar-foreground/70">Projeto selecionado</span>
            <span className="truncate text-xs font-semibold">{selected?.label ?? "Selecione um projeto"}</span>
          </span>
        </ComboboxTrigger>
        <ComboboxContent className="min-w-64">
          <ComboboxInput placeholder="Buscar projeto..." showTrigger={false} />
          <ComboboxEmpty>Nenhum projeto encontrado.</ComboboxEmpty>
          <ComboboxList>
            {(option: ComboOption) => (
              <ComboboxItem key={option.value} value={option}>
                <span className="truncate">{option.label}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

export function AppSidebar({ user }: { user: AppUser }) {
  const pathname = usePathname();
  const eapOpen = useSearchParams().get("aba") === "eap";
  const { state, toggleSidebar } = useSidebar();
  const projects = useAccessibleProjects();
  const routeProject = pathname.match(/^\/projetos\/([^/]+)$/)?.[1];
  const currentProject = routeProject && projects?.some((project) => project.value === routeProject) ? routeProject : undefined;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="overflow-hidden group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex h-15 items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <Image
            src="/brand/igepps-logo.png"
            alt="IGEPPS — Instituto de Gestão Previdenciária e Proteção Social do Estado do Pará"
            width={218}
            height={85}
            className="h-13 w-auto max-w-full min-w-0 object-contain object-left group-data-[collapsible=icon]:hidden"
          />
          <Tooltip>
            <TooltipTrigger
              type="button"
              onClick={toggleSidebar}
              className="hidden size-8 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none group-data-[collapsible=icon]:flex"
              aria-label="Expandir menu lateral"
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
              Expandir menu
            </TooltipContent>
          </Tooltip>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Recolher menu lateral"
            title="Recolher menu"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none group-data-[collapsible=icon]:hidden"
          >
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </button>
        </div>
        <ProjectSwitcher projects={projects} currentProject={currentProject} eapOpen={eapOpen} />
      </SidebarHeader>
      <SidebarContent>
        {APP_NAV_GROUPS.map((group) => (
          <Fragment key={group.label}>
          {group.label === "Gestão" ? <ProjectNav projectId={currentProject} eapOpen={eapOpen} /> : null}
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
