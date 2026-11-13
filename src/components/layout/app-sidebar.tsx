"use client";

import {
  CalendarDays,
  ChevronRight,
  FileText,
  Flag,
  History,
  LayoutDashboard,
  Network,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
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
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
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
import { useAccessibleProjects } from "./accessible-projects";
import { APP_NAV_GROUPS, type AppNavChild, type AppNavItem } from "./app-nav";

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

const PROJECT_NAV_UNAVAILABLE: ReadonlyArray<{ label: string; icon: LucideIcon }> = [
  { label: "Entregas e Homologações", icon: Flag },
  { label: "Histórico Executivo", icon: History },
  { label: "Documentos", icon: FileText },
  { label: "Equipe", icon: Users },
];

/** Itens do projeto: só habilitados quando a rota aponta para um projeto acessível (`projectId`). */
function ProjectNav({ projectId, eapOpen, scheduleOpen }: { projectId: string | undefined; eapOpen: boolean; scheduleOpen: boolean }) {
  const router = useRouter();
  const eapActive = Boolean(projectId && eapOpen);
  const scheduleActive = Boolean(projectId && scheduleOpen);
  const overviewActive = Boolean(projectId && !eapOpen && !scheduleOpen);
  const disabledProps = { "aria-disabled": true } as const;

  function open(aba?: "eap" | "cronograma") {
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
            <SidebarMenuItem>
              <SidebarMenuButton
                className={cn("cursor-pointer", !projectId && "aria-disabled:pointer-events-auto")}
                isActive={scheduleActive}
                tooltip={projectId ? "Cronograma" : "Cronograma, selecione um projeto"}
                onClick={() => open("cronograma")}
                {...(projectId ? {} : disabledProps)}
              >
                <CalendarDays className="size-4 shrink-0" />
                <span>Cronograma</span>
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
  scheduleOpen,
}: {
  projects: ComboOption[] | null;
  currentProject: string | undefined;
  eapOpen: boolean;
  scheduleOpen: boolean;
}) {
  const router = useRouter();
  const selected = projects?.find((option) => option.value === currentProject) ?? null;

  function select(id: string) {
    if (!id || id === currentProject) {
      return;
    }
    router.push(`/projetos/${id}${eapOpen ? "?aba=eap" : scheduleOpen ? "?aba=cronograma" : ""}`);
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

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("aba");
  const eapOpen = tab === "eap";
  const scheduleOpen = tab === "cronograma";
  const { projects: accessible } = useAccessibleProjects();
  const projects: ComboOption[] | null = useMemo(
    () => accessible?.map((project) => ({ value: project.id, label: project.name })) ?? null,
    [accessible],
  );
  const routeProject = pathname.match(/^\/projetos\/([^/]+)$/)?.[1];
  const currentProject = routeProject && projects?.some((project) => project.value === routeProject) ? routeProject : undefined;

  return (
    <Sidebar collapsible="icon" className={className}>
      <SidebarHeader className="overflow-hidden group-data-[collapsible=icon]:hidden">
        <ProjectSwitcher projects={projects} currentProject={currentProject} eapOpen={eapOpen} scheduleOpen={scheduleOpen} />
      </SidebarHeader>
      <SidebarContent>
        {APP_NAV_GROUPS.map((group) => (
          <Fragment key={group.label}>
            {group.label === "Gestão" ? <ProjectNav projectId={currentProject} eapOpen={eapOpen} scheduleOpen={scheduleOpen} /> : null}
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
      <SidebarRail />
    </Sidebar>
  );
}
